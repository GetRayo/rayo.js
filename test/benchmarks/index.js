import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
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
  spread,
  comparisonTable
} from '../../packages/benchmarks/index.js';
import { routeMix } from '../../packages/benchmarks/workloads.js';
import { dependencyVersion, loadPackage } from '../../packages/benchmarks/runtime.js';

export default function benchmarkTests() {
  it('reports Storm resolved by an overridden Rayo entry, including a symlinked entry', async () => {
    const temporary = mkdtempSync(join(tmpdir(), 'rayo-benchmark-version-'));
    try {
      const parent = join(temporary, 'checkout', 'rayo');
      for (const [directory, version] of [
        [parent, '9.8.7'],
        [temporary, '0.0.0-wrong-link-root']
      ]) {
        const dependency = join(directory, 'node_modules', '@rayo', 'storm');
        mkdirSync(dependency, { recursive: true });
        writeFileSync(
          join(dependency, 'package.json'),
          JSON.stringify({ name: '@rayo/storm', version, type: 'module', exports: './index.js' })
        );
        writeFileSync(join(dependency, 'index.js'), `export default ${JSON.stringify(version)};\n`);
      }
      const entry = join(parent, 'index.mjs');
      const symlink = join(temporary, 'linked-rayo.mjs');
      writeFileSync(entry, "export { default } from '@rayo/storm';\n");
      symlinkSync(entry, symlink);
      for (const override of [entry, symlink]) {
        const actual = await loadPackage('rayo', override);
        assert.equal(actual.default, '9.8.7');
        assert.equal(dependencyVersion('@rayo/storm', 'rayo', override), actual.default);
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

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

  it('plans an explicit combined comparison without changing individual server modes', () => {
    const options = parseOptions(['--mode', 'all', '--server-workers', '7']);
    const plan = createPlan(options);
    assert.equal(options['server-workers'], 7);
    assert.deepEqual(
      plan.map(({ framework, serverMode }) => [framework, serverMode]),
      [
        ['Express', 'single'],
        ['Fastify', 'single'],
        ['Polka', 'single'],
        ['Rayo', 'single'],
        ['RayoStorm', 'cluster']
      ]
    );
    for (const [only, serverMode] of [
      ['Rayo', 'single'],
      ['RayoStorm', 'cluster']
    ]) {
      assert.deepEqual(
        createPlan(parseOptions(['--mode', 'all', '--only', only])).map((entry) => [entry.framework, entry.serverMode]),
        [[only, serverMode]]
      );
    }
    assert.ok(createPlan(parseOptions([])).every((entry) => entry.serverMode === 'single'));
    assert.ok(createPlan(parseOptions(['--mode', 'cluster'])).every((entry) => entry.serverMode === 'cluster'));
    assert.throws(() => parseOptions(['--suite', 'rayo', '--mode', 'all']), /compare/);
    assert.throws(() => parseOptions(['--mode', 'all', '--baseline', '/unused']), /single/);
  });

  it('reports true peaks, arithmetic means and worker counts in the combined comparison table', () => {
    const samples = (framework, requests, peaks, latency, throughput, versions, serverWorkers = 1) =>
      requests.map((requestsPerSecond, index) => ({
        framework,
        case: 'hello',
        mode: serverWorkers === 1 ? 'single' : 'cluster',
        serverWorkers,
        versions,
        requestsPerSecond,
        peakRequestsPerSecond: peaks[index],
        latency: { mean: latency[index], p50: 99, p95: 99, p99: 99 },
        throughputBytesPerSecond: throughput[index] * 1048576
      }));
    const runs = [
      ...samples('Polka', [50, 50, 50], [70, 70, 70], [1, 1, 1], [1, 1, 1], { polka: '0.5.2' }),
      ...samples('Rayo', [100, 100, 700], [150, 200, 900], [1, 1, 7], [1, 1, 7], { rayo: '1.4.6' }),
      ...samples('Fastify', [150, 150, 150], [180, 180, 180], [1, 1, 1], [1, 1, 1], { fastify: '5.0.0' }),
      ...samples(
        'RayoStorm',
        [200, 200, 1400],
        [300, 400, 1600],
        [2, 2, 8],
        [2, 2, 8],
        { rayo: '1.4.6', '@rayo/storm': '9.8.7' },
        4
      ),
      ...samples('Express', [450, 450, 450], [500, 500, 500], [1, 1, 1], [1, 1, 1], { express: '5.1.0' })
    ];
    const output = stripVTControlCharacters(comparisonTable(runs));
    const row = (framework) => output.split('\n').find((line) => new RegExp(`\\b${framework}\\b`).test(line));
    // Skewed triples distinguish arithmetic means from medians, and latency.mean
    // from the percentile fields. Peak columns must use the maximum sampled peak.
    assert.match(row('Rayo'), /Rayo\b.*1\.4\.6.*\b1\b.*\b900\b.*300\.0.*3\.00 ms.*3\.00 MiB\/s/);
    assert.match(row('Storm'), /Storm\b.*9\.8\.7.*\b4\b.*\b1600\b.*600\.0.*4\.00 ms.*4\.00 MiB\/s/);
    const order = ['Storm', 'Express', 'Rayo', 'Fastify', 'Polka'].map((framework) => output.indexOf(row(framework)));
    assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])));
    assert.match(output, /Framework.*Version.*Workers.*Reqs\/sec \^.*Reqs\/sec \*.*Latency \*.*Throughput \*/);
    assert.match(output, /\^.*(?:peak|maximum|highest)/i);
    assert.match(output, /\*.*(?:arithmetic mean|average)/i);
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

  it('preserves response and compression behavior when selecting the server process mode', () => {
    const modesByCase = {
      'response/raw': 'raw',
      'response/auto-text': 'auto-text',
      'response/text': 'text',
      'response/object': 'object',
      'response/json': 'json',
      'response/json-string': 'json-string',
      'response/header-json': 'header-json',
      'compression-skip/no-accept': 'no-accept',
      'compression-skip/head': 'head',
      'compression-skip/below-threshold': 'below-threshold'
    };
    for (const serverMode of ['single', 'cluster']) {
      const plan = createPlan(parseOptions(['--suite', 'rayo', '--mode', serverMode]));
      for (const [id, mode] of Object.entries(modesByCase)) {
        const workload = plan.find((entry) => entry.id === id);
        assert.equal(workload.mode, mode, id);
        assert.equal(workload.serverMode, serverMode, id);
        assert.equal(workload.framework, serverMode === 'single' ? 'Rayo' : 'RayoStorm', id);
      }
      const head = plan.find((entry) => entry.id === 'compression-skip/head');
      assert.equal(head.method, 'HEAD');
      assert.equal(head.body, '');
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
    // Allow floating-point rounding from the ratio calculation and conversion to percent.
    const percentageTolerance = 100 * Number.EPSILON;
    assert.ok(Math.abs(report.pairs[0].changePercent.requestsPerSecond - 20) < percentageTolerance);
    assert.ok(Math.abs(report.pairs[1].changePercent.requestsPerSecond - 10) < percentageTolerance);
    assert.ok(Math.abs(report.summary[0].changePercent.requestsPerSecond.median - 15) < percentageTolerance);
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
    for (const mode of ['cluster', 'all']) {
      await assert.rejects(compareCheckouts(plan, { ...options, mode }), /require --suite rayo/);
    }
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
