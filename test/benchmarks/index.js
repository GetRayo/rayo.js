import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseOptions,
  createPlan,
  runOrder,
  validateResult,
  median,
  probe,
  loadRequests,
  compareCheckouts,
  pairResult,
  summarizePairs,
  sourceMetadata,
  spread
} from '../../packages/benchmarks/index.js';
import { routeMix } from '../../packages/benchmarks/workloads.js';

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
    assert.equal(createPlan({ ...options, case: 'routes' }).length, 18);
    assert.equal(createPlan({ ...options, case: 'routes/param/1000' }).length, 1);
    for (const prefix of ['middleware', 'response', 'query', 'stream', 'compression-skip']) {
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
    validateResult({ ...result, statusCodeStats: { 200: { count: 10 }, 404: { count: 10 } } }, [200, 404]);
    assert.throws(() => validateResult(result, [200, 404]), /missing statuses/);
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([5, 1, 3, 9]), 4);
  });

  it('validates mixed requests against their own expected route, status and body', () => {
    for (const count of [1, 100, 1000]) {
      const mix = routeMix(count);
      assert.equal(mix.routes.length, count);
      assert.ok(mix.requests.some((request) => request.status === 404));
      assert.ok(mix.requests.some((request) => request.path.startsWith(`/route-${count - 1}`)));
      assert.equal(routeMix(count, true).routes.length, count * 3);
    }
    let failures = 0;
    const mix = routeMix(100, true);
    const requests = loadRequests(mix, () => {
      failures += 1;
    });
    for (const [index, request] of requests.entries()) {
      assert.equal(request.path, mix.requests[index].path);
      request.onResponse(mix.requests[index].status, mix.requests[index].body);
    }
    assert.equal(failures, 0);
    requests[0].onResponse(404, mix.requests[0].body);
    requests[0].onResponse(200, mix.requests[1].body);
    assert.equal(failures, 2);
    const compressed = loadRequests({ path: '/', body: 'text', encoding: 'gzip', status: 200 }, () => {
      failures += 1;
    });
    compressed[0].onResponse(200, 'compressed bytes are validated by binary probes');
    assert.equal(failures, 2);
  });

  it('alternates paired source runs and computes changes within each pair', async () => {
    const directory = fileURLToPath(new URL('../../', import.meta.url));
    const options = parseOptions([
      '--suite',
      'rayo',
      '--baseline',
      directory,
      '--candidate',
      directory,
      '--repeats',
      '2'
    ]);
    const plan = createPlan({ ...options, case: 'query/absent' });
    const progress = [];
    let calls = 0;
    let saved = 0;
    const report = await compareCheckouts(plan, options, {
      progress: (message) => progress.push(message),
      save: () => {
        saved += 1;
      },
      run: async (workload, settings) => {
        assert.equal(settings['rayo-path'], `${directory}packages/rayo/index.js`);
        const throughput = [100, 120, 330, 300][calls++];
        return {
          case: workload.id,
          mode: settings.mode,
          requestsPerSecond: throughput,
          latency: { p50: 1, p95: 2, p99: 3 },
          cpuPercent: 90,
          peakRssBytes: 1000
        };
      }
    });
    assert.deepEqual(
      report.runs.map((run) => run.variant),
      ['baseline', 'candidate', 'candidate', 'baseline']
    );
    assert.equal(progress.length, 4);
    assert.equal(saved, 7);
    assert.equal(report.complete, true);
    assert.equal(report.pairs.length, 2);
    assert.ok(Math.abs(report.pairs[0].changePercent.requestsPerSecond - 20) < 1e-10);
    assert.ok(Math.abs(report.pairs[1].changePercent.requestsPerSecond - 10) < 1e-10);
    assert.ok(Math.abs(report.summary[0].changePercent.requestsPerSecond.median - 15) < 1e-10);
    assert.deepEqual(summarizePairs([]), []);
    assert.deepEqual(spread([2, 8, 5]), { median: 5, min: 2, max: 8 });
    assert.throws(() => spread([]), /finite samples/);
    assert.throws(() => pairResult({ case: 'a' }, { case: 'b' }), /same case/);
    assert.throws(() => parseOptions(['--candidate', directory]), /requires --baseline/);
    assert.throws(() => parseOptions(['--baseline', directory]), /require --suite rayo/);
    assert.throws(
      () => parseOptions(['--suite', 'rayo', '--baseline', directory, '--rayo-path', 'file']),
      /entry-point overrides/
    );
    assert.ok(sourceMetadata(directory).sha256['packages/rayo/index.js']);
    await assert.rejects(compareCheckouts(plan, { ...options, mode: 'cluster' }), /require --suite rayo/);
  });

  it('probes HEAD with the configured method and an empty response body', async () => {
    let method;
    const server = createServer((req, res) => {
      method = req.method;
      res.setHeader('content-length', 4);
      res.end('body');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      await probe(`http://127.0.0.1:${server.address().port}/`, { method: 'HEAD', status: 200, body: '' });
      assert.equal(method, 'HEAD');
    } finally {
      await new Promise((yes) => server.close(yes));
    }
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
