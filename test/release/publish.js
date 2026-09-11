import assert from 'node:assert/strict';
import { checkVersions, finalizeRelease, releasePackages } from '../../.github/scripts/publish.mjs';

const revision = 'a'.repeat(40);
const packages = ['@rayo/benchmarks', '@rayo/compress', 'rayo', '@rayo/send', '@rayo/storm'].map((name) => ({
  name,
  version: '2.0.0',
  tag: `${name}@2.0.0`
}));
const notFound = () => Object.assign(new Error('Not found'), { status: 404 });

function fixtures() {
  const records = new Map(packages.map((pkg) => [pkg.name, { ...pkg, gitHead: revision }]));
  const tags = new Map();
  const calls = [];
  const releases = new Map();
  const request = async (url) => {
    const [name, version] = new URL(url).pathname.slice(1).split('/').map(decodeURIComponent);
    const record = records.get(name);
    if (!record || (version !== 'latest' && record.version !== version)) {
      return new Response('', { status: 404 });
    }
    return Response.json(record);
  };
  const github = {
    rest: {
      repos: {
        getCommit: async ({ ref }) => {
          if (!tags.has(ref)) {
            throw notFound();
          }
          return { data: { sha: tags.get(ref) } };
        },
        getReleaseByTag: async ({ tag }) => {
          if (!releases.has(tag)) {
            throw notFound();
          }
          return { data: releases.get(tag) };
        },
        createRelease: async (input) => {
          calls.push(['release', input]);
          const data = { ...input, html_url: `https://github.com/test/rayo/releases/tag/${input.tag_name}` };
          releases.set(input.tag_name, data);
          return { data };
        }
      },
      git: {
        createRef: async (input) => {
          calls.push(['tag', input]);
          tags.set(input.ref, input.sha);
        }
      }
    }
  };
  const summary = {
    addHeading: () => summary,
    addTable: () => summary,
    addLink: () => summary,
    write: async () => {}
  };
  return {
    records,
    tags,
    calls,
    releases,
    options: {
      github,
      context: { repo: { owner: 'test', repo: 'rayo' } },
      core: { summary },
      revision,
      packages,
      request
    }
  };
}

export default function publishTests() {
  it('includes each publishable workspace with its committed independent version', () => {
    const actual = releasePackages();
    assert.deepEqual(actual.map((pkg) => pkg.name).sort(), packages.map((pkg) => pkg.name).sort());
    assert.ok(actual.every((pkg) => pkg.tag === `${pkg.name}@${pkg.version}`));
  });

  it('accepts missing versions and versions already published by the same release', async () => {
    const { records, options } = fixtures();
    records.delete('rayo');
    const state = await checkVersions(options);
    assert.equal(state.filter((pkg) => pkg.published).length, 4);
    assert.equal(state.find((pkg) => pkg.name === 'rayo').published, false);
  });

  it('prevents an older partial release from replacing a newer npm latest version', async () => {
    const { records, options } = fixtures();
    for (const version of ['3.0.0', '2.1.0', '2.0.1', '2.0.1-rc.1']) {
      records.set('@rayo/send', { name: '@rayo/send', version });
      await assert.rejects(checkVersions(options), /would replace a newer or mismatched npm latest version/);
    }
  });

  it('allows newer stable releases and promotion from a prerelease at the same version', async () => {
    const { records, options } = fixtures();
    for (const version of ['1.99.99', '2.0.0-rc.1', '2.0.0-rc.1+build.5']) {
      records.set('rayo', { name: 'rayo', version });
      const state = await checkVersions(options);
      assert.equal(state.find((pkg) => pkg.name === 'rayo').published, false);
    }
  });

  it('fails closed when the npm latest lookup fails or returns invalid metadata', async () => {
    const { options } = fixtures();
    for (const response of [
      new Response('', { status: 503 }),
      Response.json({ name: 'rayo', version: 'invalid' }),
      Response.json({ name: 'another-package', version: '1.0.0' })
    ]) {
      const request = async (url) => (url.endsWith('/latest') ? response : new Response('', { status: 404 }));
      await assert.rejects(checkVersions({ ...options, packages: [packages[2]], request }));
    }
  });

  it('rejects lookup failures and mismatched published sources', async () => {
    const { records, options } = fixtures();
    await assert.rejects(checkVersions({ ...options, request: async () => new Response('', { status: 503 }) }), /503/);
    await assert.rejects(checkVersions({ ...options, revision: undefined }), /RELEASE_SHA/);
    for (const change of [{ gitHead: 'b'.repeat(40) }, { version: '1.0.0' }, { name: 'another-package' }]) {
      const saved = records.get('rayo');
      records.set('rayo', { ...saved, ...change });
      const request = async () => Response.json(records.get('rayo'));
      await assert.rejects(
        checkVersions({ ...options, packages: [packages[2]], request }),
        /different source metadata/
      );
      records.set('rayo', saved);
    }
  });

  it('creates no tags or releases until every npm package has reached the registry', async () => {
    const { records, calls, options } = fixtures();
    records.delete('@rayo/storm');
    await assert.rejects(finalizeRelease(options), /has not reached npm/);
    assert.deepEqual(calls, []);
  });

  it('creates five source tags and one Rayo release listing all npm versions', async () => {
    const { calls, options } = fixtures();
    await finalizeRelease(options);
    assert.equal(calls.filter(([kind]) => kind === 'tag').length, 5);
    assert.ok(calls.filter(([kind]) => kind === 'tag').every(([, input]) => input.sha === revision));
    const releases = calls.filter(([kind]) => kind === 'release');
    assert.equal(releases.length, 1);
    const [, release] = releases[0];
    assert.equal(release.target_commitish, revision);
    assert.equal(release.tag_name, 'rayo@2.0.0');
    assert.equal(release.generate_release_notes, true);
    assert.equal(release.make_latest, 'true');
    for (const pkg of packages) {
      assert.ok(release.body.includes(`| ${pkg.name} | ${pkg.version} |`));
    }
  });

  it('leaves an existing complete release and its tags unchanged', async () => {
    const { calls, options } = fixtures();
    const release = await finalizeRelease(options);
    calls.length = 0;
    assert.deepEqual(await finalizeRelease(options), release);
    assert.deepEqual(calls, []);
  });

  it('recovers missing GitHub release bookkeeping after npm publication', async () => {
    const { calls, tags, options } = fixtures();
    const createRelease = options.github.rest.repos.createRelease;
    options.github.rest.repos.createRelease = async () => {
      throw new Error('GitHub unavailable');
    };
    await assert.rejects(finalizeRelease(options), /GitHub unavailable/);
    assert.equal(tags.size, 5);
    calls.length = 0;
    options.github.rest.repos.createRelease = createRelease;
    await finalizeRelease(options);
    assert.deepEqual(
      calls.map(([kind]) => kind),
      ['release']
    );
  });

  it('refuses to move an existing tag that identifies another source commit', async () => {
    const { calls, tags, options } = fixtures();
    tags.set('refs/tags/@rayo/storm@2.0.0', 'b'.repeat(40));
    await assert.rejects(finalizeRelease(options), /points at a different commit/);
    assert.deepEqual(calls, []);
  });

  it('propagates GitHub permission failures without treating tags as absent', async () => {
    const { calls, options } = fixtures();
    options.github.rest.repos.getCommit = async () => {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    };
    await assert.rejects(finalizeRelease(options), /Forbidden/);
    assert.deepEqual(calls, []);
  });

  it('does not replace latest when finishing an older release', async () => {
    const { calls, options } = fixtures();
    const request = options.request;
    options.request = (url, init) =>
      url.endsWith('/latest') ? Promise.resolve(Response.json({ version: '3.0.0' })) : request(url, init);
    assert.ok((await checkVersions(options)).every((pkg) => pkg.published));
    await finalizeRelease(options);
    assert.equal(calls.find(([kind]) => kind === 'release')[1].make_latest, 'false');
  });

  it('reports an existing draft as incomplete', async () => {
    const { releases, options } = fixtures();
    releases.set('rayo@2.0.0', { draft: true });
    await assert.rejects(finalizeRelease(options), /is a draft/);
  });
}
