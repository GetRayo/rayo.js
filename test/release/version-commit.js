import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { commitVersions } from '../../.github/scripts/version-commit.mjs';

const packages = ['benchmarks', 'compress', 'rayo', 'send', 'storm'];
const files = ['package-lock.json', ...packages.map((name) => `packages/${name}/package.json`)];

function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), 'rayo-version-commit-'));
  const cwd = join(temporary, 'checkout');
  const remote = join(temporary, 'remote.git');
  mkdirSync(cwd);
  const git = (args, options = {}) =>
    execFileSync('git', ['-c', 'commit.gpgSign=false', ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    }).trim();
  const write = (path, contents) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), contents);
  };
  git(['init', '--initial-branch=master']);
  git(['config', 'user.name', 'Release Test']);
  git(['config', 'user.email', 'release@example.test']);
  for (const name of packages) {
    write(
      `packages/${name}/package.json`,
      JSON.stringify({ name: name === 'rayo' ? name : `@rayo/${name}`, version: '1.0.0' })
    );
  }
  write('package-lock.json', JSON.stringify({ lockfileVersion: 3, version: '1.0.0' }));
  write('readme.md', 'Rayo\n');
  git(['add', '.']);
  const base = git(['commit-tree', git(['write-tree']), '-m', 'Initial packages']);
  git(['update-ref', 'refs/heads/master', base]);
  git(['clone', '--bare', cwd, remote]);
  git(['remote', 'add', 'origin', remote]);
  for (const path of files) {
    const value = JSON.parse(readFileSync(join(cwd, path), 'utf8'));
    value.version = '1.0.1';
    write(path, JSON.stringify(value));
  }

  const createRemoteCommit = (changes, parent = base, extraParents = []) => {
    const options = { env: { ...process.env, GIT_INDEX_FILE: join(temporary, 'remote-index') } };
    git(['read-tree', parent], options);
    for (const [path, contents] of Object.entries(changes)) {
      const blob = git(['hash-object', '-w', '--stdin'], { input: contents });
      git(['update-index', '--add', '--cacheinfo', '100644', blob, path], options);
    }
    const tree = git(['write-tree'], options);
    const oid = git([
      'commit-tree',
      tree,
      '-p',
      parent,
      ...extraParents.flatMap((sha) => ['-p', sha]),
      '-m',
      'Update packages'
    ]);
    git(['push', 'origin', `${oid}:refs/heads/master`]);
    return { oid, tree: { oid: tree } };
  };
  const calls = [];
  const outputs = [];
  const context = {
    sha: base,
    repo: { owner: 'GetRayo', repo: 'rayo.js' },
    payload: { repository: { default_branch: 'master' } }
  };
  const github = {
    graphql: async (query, variables) => {
      calls.push({ query, variables });
      const changes = Object.fromEntries(
        variables.input.fileChanges.additions.map(({ path, contents }) => [path, Buffer.from(contents, 'base64')])
      );
      return { createCommitOnBranch: { commit: createRemoteCommit(changes) } };
    }
  };
  const options = { github, context, core: { info() {}, setOutput: (...args) => outputs.push(args) }, cwd };
  const preparedFiles = () => Object.fromEntries(files.map((path) => [path, readFileSync(join(cwd, path))]));
  return {
    base,
    git,
    write,
    calls,
    outputs,
    options,
    preparedFiles,
    createRemoteCommit,
    close: () => rmSync(temporary, { recursive: true, force: true })
  };
}

export default function versionCommitTests() {
  let repo;
  beforeEach(() => {
    repo = fixture();
  });
  afterEach(() => repo.close());

  it('creates the prepared version tree through the signed GitHub commit API', async () => {
    const sha = await commitVersions(repo.options);
    assert.equal(repo.calls.length, 1);
    const { query, variables } = repo.calls[0];
    assert.match(query, /createCommitOnBranch/);
    assert.deepEqual(variables.input.branch, { repositoryNameWithOwner: 'GetRayo/rayo.js', branchName: 'master' });
    assert.equal(variables.input.expectedHeadOid, repo.base);
    assert.deepEqual(variables.input.message, {
      headline: 'Publish package versions',
      body: '@rayo/benchmarks@1.0.1\n@rayo/compress@1.0.1\nrayo@1.0.1\n@rayo/send@1.0.1\n@rayo/storm@1.0.1'
    });
    assert.deepEqual(
      variables.input.fileChanges.additions.map(({ path }) => path),
      files
    );
    for (const { path, contents } of variables.input.fileChanges.additions) {
      assert.deepEqual(Buffer.from(contents, 'base64'), repo.preparedFiles()[path]);
    }
    assert.equal(repo.git(['show', '-s', '--format=%P', sha]), repo.base);
    assert.equal(repo.git(['rev-parse', `${sha}^{tree}`]), repo.git(['write-tree']));
    assert.deepEqual(repo.outputs, [['sha', sha]]);
  });

  it('reuses the identical first child after publication advanced the default branch', async () => {
    const commit = repo.createRemoteCommit(repo.preparedFiles());
    await repo.createRemoteCommit({ 'readme.md': 'More documentation\n' }, commit.oid);
    assert.equal(await commitVersions(repo.options), commit.oid);
    assert.equal(repo.calls.length, 0);
    assert.deepEqual(repo.outputs, [['sha', commit.oid]]);
  });

  it('rejects a changed default branch with an unrelated first child', async () => {
    repo.createRemoteCommit({ 'readme.md': 'Another change\n' });
    await assert.rejects(commitVersions(repo.options), /default branch changed/);
    assert.equal(repo.calls.length, 0);
    assert.deepEqual(repo.outputs, []);
  });

  it('does not recover a later identical tree after an unrelated first child', async () => {
    const first = repo.createRemoteCommit({ 'readme.md': 'Another change\n' });
    repo.createRemoteCommit({ ...repo.preparedFiles(), 'readme.md': 'Rayo\n' }, first.oid);
    await assert.rejects(commitVersions(repo.options), /default branch changed/);
    assert.equal(repo.calls.length, 0);
  });

  it('rejects a version commit that also changes another file', async () => {
    repo.createRemoteCommit({ ...repo.preparedFiles(), 'readme.md': 'Another change\n' });
    await assert.rejects(commitVersions(repo.options), /default branch changed/);
    assert.equal(repo.calls.length, 0);
  });

  it('rejects an identical version tree in a merge commit', async () => {
    const side = repo.createRemoteCommit({ 'readme.md': 'Another change\n' });
    repo.createRemoteCommit(repo.preparedFiles(), repo.base, [side.oid]);
    await assert.rejects(commitVersions(repo.options), /default branch changed/);
    assert.equal(repo.calls.length, 0);
  });

  it('propagates a branch race at the atomic API update without producing a release SHA', async () => {
    repo.options.github.graphql = async () => {
      repo.createRemoteCommit({ 'readme.md': 'Concurrent change\n' });
      throw new Error('Expected head does not match the current branch head');
    };
    await assert.rejects(commitVersions(repo.options), /Expected head does not match/);
    assert.deepEqual(repo.outputs, []);
  });

  it('rejects unexpected tracked changes before contacting GitHub', async () => {
    repo.write('readme.md', 'Another change\n');
    await assert.rejects(commitVersions(repo.options), /Unexpected versioning changes: readme.md/);
    assert.equal(repo.calls.length, 0);
  });

  it('rejects unexpected staged changes even when the working file matches the base', async () => {
    repo.write('readme.md', 'Staged change\n');
    repo.git(['add', 'readme.md']);
    repo.write('readme.md', 'Rayo\n');
    await assert.rejects(commitVersions(repo.options), /Unexpected versioning changes: readme.md/);
    assert.equal(repo.calls.length, 0);
  });

  it('preserves whitespace when validating changed file names', async () => {
    repo.write(' package-lock.json', '{}');
    repo.git(['add', ' package-lock.json']);
    await assert.rejects(commitVersions(repo.options), /Unexpected versioning changes:  package-lock.json/);
    assert.equal(repo.calls.length, 0);
  });

  it('rejects an incomplete version bump', async () => {
    repo.write('packages/send/package.json', JSON.stringify({ name: '@rayo/send', version: '1.0.0' }));
    await assert.rejects(commitVersions(repo.options), /Expected a new package version/);
    assert.equal(repo.calls.length, 0);
  });

  it('rejects an API result whose complete tree differs from the prepared version tree', async () => {
    repo.options.github.graphql = async () => ({
      createCommitOnBranch: {
        commit: { oid: repo.base, tree: { oid: repo.git(['rev-parse', `${repo.base}^{tree}`]) } }
      }
    });
    await assert.rejects(commitVersions(repo.options), /does not match the prepared files/);
    assert.deepEqual(repo.outputs, []);
  });
}
