import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOptions, createPlan, runOrder, validateResult, median, probe } from '../../packages/benchmarks/index.js';

export default function benchmarkTests() {
  it('runs the installed command through a bin symlink independently of the current directory', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'rayo-benchmark-cli-'));
    try {
      const command = join(temporary, 'rayobench');
      symlinkSync(fileURLToPath(new URL('../../packages/benchmarks/index.js', import.meta.url)), command);
      const output = execFileSync(process.execPath, [command, '--list', '--only', 'Rayo'], {
        cwd: temporary,
        encoding: 'utf8'
      });
      assert.equal(output, 'Rayo\thello\n');
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('keeps cluster servers out of single-process comparisons', () => {
    assert.deepEqual(
      createPlan(parseOptions([])).map((entry) => entry.framework),
      ['Express', 'Fastify', 'Polka', 'Rayo']
    );
    assert.deepEqual(
      createPlan(parseOptions(['--mode', 'cluster'])).map((entry) => entry.framework),
      ['RayoStorm']
    );
    assert.throws(() => createPlan(parseOptions(['--only', 'RayoStorm'])), /No benchmarks match/);
  });

  it('rejects invalid settings and unknown filters instead of silently benchmarking defaults', () => {
    for (const args of [['-d', '0'], ['-c', '-1'], ['-r', '1.5'], ['--mode', 'both'], ['--typo'], ['--wat=2']]) {
      assert.throws(() => parseOptions(args));
    }
    assert.throws(() => createPlan(parseOptions(['--suite', 'rayo', '--case', 'nonexistent'])), /No benchmarks match/);
    assert.equal(parseOptions(['--warmup', '0']).warmup, 0);
  });

  it('includes route scaling and bounded middleware, payload, query and compression workloads', () => {
    const options = parseOptions(['--suite', 'rayo']);
    const plan = createPlan(options);
    assert.equal(new Set(plan.map((entry) => entry.id)).size, plan.length);
    assert.equal(createPlan({ ...options, case: 'routes' }).length, 12);
    assert.equal(createPlan({ ...options, case: 'routes/param/1000' }).length, 1);
    for (const prefix of ['middleware', 'response', 'query', 'stream']) {
      assert.ok(createPlan({ ...options, case: prefix }).length > 1);
    }
  });

  it('shuffles without dropping entries and alternates order reproducibly', () => {
    const plan = createPlan(parseOptions([]));
    const original = [...plan];
    const first = runOrder(plan, 42, 0);
    assert.deepEqual(runOrder(plan, 42, 2), first);
    assert.deepEqual(runOrder(plan, 42, 1), [...first].reverse());
    assert.equal(new Set(first).size, plan.length);
    assert.deepEqual(plan, original);
  });

  it('rejects transport failures, wrong statuses and bodies but permits expected 404 workloads', () => {
    const result = {
      errors: 0,
      timeouts: 0,
      mismatches: 0,
      statusCodeStats: { 200: { count: 20 } },
      requests: { total: 20 }
    };
    validateResult(result, 200);
    for (const metric of ['errors', 'timeouts', 'mismatches']) {
      assert.throws(() => validateResult({ ...result, [metric]: 1 }, 200), /Invalid run/);
    }
    assert.throws(() => validateResult(result, 404), /unexpected statuses/);
    assert.throws(() => validateResult({ ...result, requests: { total: 0 } }, 200), /Invalid run/);
    validateResult({ ...result, statusCodeStats: { 404: { count: 20 } } }, 404);
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([5, 1, 3, 9]), 4);
  });

  it('validates decompressed probe bodies and rejects incorrect encoding, content and status', async () => {
    const server = createServer((req, res) => {
      res.setHeader('content-encoding', 'gzip');
      res.end(gzipSync('correct body'));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/`;
    const workload = { id: 'probe', status: 200, body: 'correct body', encoding: 'gzip' };
    try {
      await probe(url, workload);
      await assert.rejects(probe(url, { ...workload, body: 'wrong' }), /Unexpected response body/);
      await assert.rejects(probe(url, { ...workload, status: 404 }), /Expected HTTP 404/);
      await assert.rejects(probe(url, { ...workload, encoding: undefined }), /Expected content encoding identity/);
    } finally {
      await new Promise((yes) => server.close(yes));
    }
  });
}
