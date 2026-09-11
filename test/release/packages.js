import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackages } from '../../scripts/check-packages.mjs';

const command = fileURLToPath(new URL('../../scripts/check-packages.mjs', import.meta.url));

function fixture() {
  return [
    ['rayo', 'index.d.ts', 'bridge.mjs', 'router.mjs', 'route-parser.mjs', 'request.mjs'],
    ['@rayo/compress', 'index.d.ts'],
    ['@rayo/send', 'index.d.ts'],
    ['@rayo/storm', 'index.d.ts', 'monitor.mjs', 'pathname.mjs', 'log.mjs'],
    [
      '@rayo/benchmarks',
      'help.txt',
      'runtime.js',
      'workloads.js',
      'compare/Express.js',
      'compare/Fastify.js',
      'compare/Polka.js',
      'compare/Rayo.js',
      'compare/RayoStorm.js'
    ]
  ].map(([name, ...paths]) => ({
    name,
    files: ['package.json', 'index.js', 'readme.md', 'LICENSE', ...paths].map((path) => ({ path, mode: 0o755 }))
  }));
}

export default function packageTests() {
  it('prepares the lowercase README and each workspace license independently of the current directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'rayo-packages-'));
    const workspaces = ['packages/rayo', 'packages/another workspace'];
    try {
      mkdirSync(join(directory, 'scripts'));
      for (const workspace of workspaces) {
        mkdirSync(join(directory, workspace), { recursive: true });
      }
      writeFileSync(join(directory, 'package.json'), JSON.stringify({ workspaces }));
      writeFileSync(join(directory, 'readme.md'), 'Package documentation\n');
      writeFileSync(join(directory, 'LICENSE'), 'Package license\n');
      const script = join(directory, 'scripts/prepare-packages.mjs');
      copyFileSync(new URL('../../scripts/prepare-packages.mjs', import.meta.url), script);
      execFileSync(process.execPath, [script], { cwd: tmpdir() });
      assert.equal(readFileSync(join(directory, 'packages/rayo/readme.md'), 'utf8'), 'Package documentation\n');
      for (const workspace of workspaces) {
        assert.equal(readFileSync(join(directory, workspace, 'LICENSE'), 'utf8'), 'Package license\n');
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('accepts all five packages in any order and the README casing used by npm', () => {
    const packages = fixture().reverse();
    packages[0].files.find((file) => file.path === 'readme.md').path = 'README.md';
    assert.doesNotThrow(() => validatePackages(packages));
  });

  it('rejects missing, duplicate and unexpected packages', () => {
    const packages = fixture();
    for (const invalid of [
      packages.slice(1),
      [...packages, packages[0]],
      [packages[0], ...packages.slice(0, -1)],
      [{ name: 'unrelated' }, ...packages.slice(1)]
    ]) {
      assert.throws(() => validatePackages(invalid), /five public workspace packages/);
    }
  });

  it('requires documentation, declarations and runtime files in their own package', () => {
    for (const [index, entry] of fixture().entries()) {
      for (const { path } of entry.files) {
        const packages = fixture();
        packages[index].files = packages[index].files.filter((file) => file.path !== path);
        // A misplaced file in another package must not satisfy this package's requirement.
        packages[(index + 1) % packages.length].files.push({ path, mode: 0o755 });
        assert.throws(
          () => validatePackages(packages),
          (error) => {
            assert.ok(error.message.startsWith(`${entry.name}: missing `), error.message);
            return true;
          }
        );
      }
    }
  });

  it('requires an executable rayobench entry point', () => {
    const packages = fixture();
    const benchmarks = packages.find((entry) => entry.name === '@rayo/benchmarks');
    benchmarks.files.find((file) => file.path === 'index.js').mode = 0o644;
    assert.throws(() => validatePackages(packages), /rayobench entry point must be executable/);
  });

  it('reads npm pack JSON from stdin and fails for malformed or incomplete output', () => {
    const output = execFileSync(process.execPath, [command], {
      input: JSON.stringify(fixture()),
      encoding: 'utf8'
    });
    assert.match(output, /Validated five publishable packages/);
    for (const input of ['', 'npm notice\n[]', '{}', '[]', JSON.stringify(fixture().slice(1))]) {
      const result = spawnSync(process.execPath, [command], { input, encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
    }
  });
}
