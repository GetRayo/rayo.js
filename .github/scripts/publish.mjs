import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const registry = 'https://registry.npmjs.org';

export function releasePackages(directory = process.cwd()) {
  const root = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  return root.workspaces.map((workspace) => {
    const {
      name,
      version,
      private: privatePackage
    } = JSON.parse(readFileSync(resolve(directory, workspace, 'package.json'), 'utf8'));
    if (privatePackage || !/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`Expected a public package with a stable version: ${workspace}`);
    }
    return { name, version, tag: `${name}@${version}` };
  });
}

async function npmVersion(name, version, request) {
  const response = await request(`${registry}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(30000)
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`npm lookup failed for ${name}@${version}: HTTP ${response.status}`);
  }
  return response.json();
}

function newerThanStable(version, stable) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i.exec(version);
  if (!match) {
    throw new Error(`Invalid npm latest version: ${version}`);
  }
  const target = stable.split('.').map(Number);
  // A prerelease with the same numeric version precedes a stable release.
  for (let index = 0; index < target.length; index++) {
    const latest = Number(match[index + 1]);
    if (latest !== target[index]) {
      return latest > target[index];
    }
  }
  return false;
}

export async function checkVersions({ revision, packages = releasePackages(), request = fetch, complete = false }) {
  if (!/^[a-f0-9]{40}$/.test(revision || '')) {
    throw new Error('RELEASE_SHA must identify the version commit');
  }
  return Promise.all(
    packages.map(async (pkg) => {
      const published = await npmVersion(pkg.name, pkg.version, request);
      if (!published) {
        if (complete) {
          throw new Error(`${pkg.tag} has not reached npm; re-run the failed publish job`);
        }
        const latest = await npmVersion(pkg.name, 'latest', request);
        if (latest && (latest.name !== pkg.name || newerThanStable(latest.version, pkg.version))) {
          throw new Error(`${pkg.tag} would replace a newer or mismatched npm latest version; start a new Publish run`);
        }
        return { ...pkg, published: false };
      }
      if (published.name !== pkg.name || published.version !== pkg.version || published.gitHead !== revision) {
        throw new Error(`${pkg.tag} is already on npm with different source metadata`);
      }
      return { ...pkg, published: true };
    })
  );
}

async function existing(read) {
  try {
    return (await read()).data;
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
    return null;
  }
}

export async function finalizeRelease({
  github,
  context,
  core,
  revision,
  packages = releasePackages(),
  request = fetch
}) {
  const published = await checkVersions({ revision, packages, request, complete: true });
  const rayo = published.find((pkg) => pkg.name === 'rayo');
  if (!rayo) {
    throw new Error('The release must include rayo');
  }
  const tags = await Promise.all(
    published.map(async (pkg) => {
      const commit = await existing(() =>
        github.rest.repos.getCommit({ ...context.repo, ref: `refs/tags/${pkg.tag}` })
      );
      if (commit && commit.sha !== revision) {
        throw new Error(`Tag ${pkg.tag} points at a different commit`);
      }
      return { ...pkg, exists: Boolean(commit) };
    })
  );
  for (const pkg of tags) {
    if (!pkg.exists) {
      await github.rest.git.createRef({ ...context.repo, ref: `refs/tags/${pkg.tag}`, sha: revision });
    }
  }
  let release = await existing(() => github.rest.repos.getReleaseByTag({ ...context.repo, tag: rayo.tag }));
  if (!release) {
    const latest = await npmVersion('rayo', 'latest', request);
    const rows = published.map(
      (pkg) => `| ${pkg.name} | ${pkg.version} | [npm](https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}) |`
    );
    const body = ['## Packages', '', '| Package | Version | Registry |', '| --- | --- | --- |', ...rows].join('\n');
    ({ data: release } = await github.rest.repos.createRelease({
      ...context.repo,
      tag_name: rayo.tag,
      target_commitish: revision,
      name: `Rayo ${rayo.version}`,
      body,
      generate_release_notes: true,
      make_latest: latest?.version === rayo.version ? 'true' : 'false'
    }));
  }
  if (release.draft) {
    throw new Error(`Release ${rayo.tag} is a draft; publish it on GitHub before completing this run`);
  }
  await core.summary
    .addHeading(`Published Rayo ${rayo.version}`)
    .addTable([
      [
        { data: 'Package', header: true },
        { data: 'Version', header: true }
      ],
      ...published.map((pkg) => [pkg.name, pkg.version])
    ])
    .addLink('GitHub release', release.html_url)
    .write();
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] !== 'check') {
    throw new Error('Usage: node .github/scripts/publish.mjs check');
  }
  const packages = await checkVersions({ revision: process.env.RELEASE_SHA });
  for (const pkg of packages) {
    console.log(`${pkg.tag}: ${pkg.published ? 'already published from this commit' : 'ready to publish'}`);
  }
}
