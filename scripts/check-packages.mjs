import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredFiles = {
  '@rayo/benchmarks': [
    'help.txt',
    'runtime.js',
    'workloads.js',
    'compare/Express.js',
    'compare/Fastify.js',
    'compare/Polka.js',
    'compare/Rayo.js',
    'compare/RayoStorm.js'
  ],
  '@rayo/compress': ['index.d.ts'],
  rayo: ['index.d.ts', 'bridge.mjs', 'router.mjs', 'route-parser.mjs', 'request.mjs'],
  '@rayo/send': ['index.d.ts'],
  '@rayo/storm': ['index.d.ts', 'monitor.mjs', 'pathname.mjs', 'log.mjs']
};

export function validatePackages(packages) {
  assert.ok(Array.isArray(packages), 'Expected an array of npm pack results');
  assert.deepEqual(
    packages.map((entry) => entry.name).sort(),
    Object.keys(requiredFiles).sort(),
    'Expected exactly the five public workspace packages'
  );

  for (const entry of packages) {
    assert.ok(Array.isArray(entry.files), `${entry.name}: missing packed file list`);
    const paths = new Set(entry.files.map((file) => file.path));
    assert.ok(
      [...paths].some((path) => /^readme\.md$/i.test(path)),
      `${entry.name}: missing README`
    );
    for (const path of ['package.json', 'index.js', 'LICENSE', ...requiredFiles[entry.name]]) {
      assert.ok(paths.has(path), `${entry.name}: missing ${path}`);
    }
    if (entry.name === '@rayo/benchmarks') {
      const command = entry.files.find((file) => file.path === 'index.js');
      assert.ok(command.mode & 0o111, `${entry.name}: rayobench entry point must be executable`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validatePackages(JSON.parse(readFileSync(0, 'utf8')));
  console.log('Validated five publishable packages.');
}
