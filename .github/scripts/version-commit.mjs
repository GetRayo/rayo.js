import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifests = ['benchmarks', 'compress', 'rayo', 'send', 'storm'].map((name) => `packages/${name}/package.json`);
const files = ['package-lock.json', ...manifests];

export async function commitVersions({ github, context, core, cwd = process.cwd() }) {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trimEnd();
  const base = context.sha;
  const branch = context.payload.repository.default_branch;
  if (git('rev-parse', 'HEAD') !== base) {
    throw new Error('Versioning must start at the workflow commit.');
  }

  const changed = new Set(
    [git('diff', '--name-only', '--no-renames', '-z', 'HEAD'), git('diff', '--cached', '--name-only', '-z')]
      .flatMap((names) => names.split('\0'))
      .filter(Boolean)
  );
  const unexpected = [...changed].filter((path) => !files.includes(path));
  if (unexpected.length) {
    throw new Error(`Unexpected versioning changes: ${unexpected.join(', ')}`);
  }

  const versions = manifests.map((path) => {
    const current = JSON.parse(readFileSync(resolve(cwd, path), 'utf8'));
    const previous = JSON.parse(git('show', `${base}:${path}`));
    if (current.name !== previous.name || !current.version || current.version === previous.version) {
      throw new Error(`Expected a new package version in ${path}.`);
    }
    return `${current.name}@${current.version}`;
  });
  git('add', '--', ...files);
  const tree = git('write-tree');
  git('fetch', '--no-tags', 'origin', `refs/heads/${branch}`);
  const head = git('rev-parse', 'FETCH_HEAD');
  let sha;

  if (head !== base) {
    const first = git('rev-list', '--first-parent', '--reverse', `${base}..${head}`).split('\n')[0];
    if (!first || git('show', '-s', '--format=%P', first) !== base || git('rev-parse', `${first}^{tree}`) !== tree) {
      throw new Error('The default branch changed before versioning. Start a new Publish run.');
    }
    sha = first;
    core.info(`Reusing the existing package version commit ${sha}.`);
  } else {
    const result = await github.graphql(
      `mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit { oid tree { oid } }
        }
      }`,
      {
        input: {
          branch: { repositoryNameWithOwner: `${context.repo.owner}/${context.repo.repo}`, branchName: branch },
          expectedHeadOid: base,
          message: { headline: 'Publish package versions', body: versions.join('\n') },
          fileChanges: {
            additions: files.map((path) => ({
              path,
              contents: readFileSync(resolve(cwd, path)).toString('base64')
            }))
          }
        }
      }
    );
    const commit = result.createCommitOnBranch.commit;
    if (commit.tree.oid !== tree) {
      throw new Error('The package version commit does not match the prepared files.');
    }
    sha = commit.oid;
  }

  core.setOutput('sha', sha);
  return sha;
}
