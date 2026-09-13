#!/usr/bin/env node

import { fork, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { request } from 'node:http';
import { readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { availableParallelism, arch, cpus, platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import autocannon from 'autocannon';
import { build } from 'hdr-histogram-js';
import minimist from 'minimist';
import Table from 'cli-table';
import { workloads } from './workloads.js';

const base = dirname(fileURLToPath(import.meta.url));
const frameworks = ['Express', 'Fastify', 'Polka', 'Rayo'];

export function parseOptions(args) {
  const options = minimist(args, {
    alias: {
      c: 'connections',
      p: 'pipelining',
      d: 'duration',
      r: 'repeats',
      o: 'only',
      w: 'server-workers',
      h: 'help'
    },
    boolean: ['help', 'list'],
    string: [
      'suite',
      'mode',
      'only',
      'case',
      'output',
      'rayo-path',
      'send-path',
      'compress-path',
      'baseline',
      'candidate',
      'connections',
      'pipelining',
      'duration',
      'warmup',
      'repeats',
      'server-workers',
      'seed'
    ],
    default: {
      connections: 50,
      pipelining: 1,
      duration: 5,
      warmup: 2,
      repeats: 3,
      suite: 'compare',
      mode: 'single',
      'server-workers': 2,
      seed: 1
    },
    unknown: (arg) => {
      if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    }
  });
  if (options._.length) throw new Error(`Unexpected arguments: ${options._.join(' ')}`);
  for (const key of ['connections', 'pipelining', 'duration', 'warmup', 'repeats', 'server-workers', 'seed']) {
    options[key] = Number(options[key]);
    if (!Number.isSafeInteger(options[key]) || options[key] < (key === 'warmup' ? 0 : 1)) {
      throw new Error(`--${key} must be ${key === 'warmup' ? 'a non-negative' : 'a positive'} integer`);
    }
  }
  if (!['compare', 'rayo'].includes(options.suite)) throw new Error('--suite must be compare or rayo');
  if (!['single', 'cluster', 'all'].includes(options.mode)) throw new Error('--mode must be single, cluster, or all');
  if (options.mode === 'all' && options.suite !== 'compare') throw new Error('--mode all requires --suite compare');
  if (options.only) options.only = options.only.replace(/\.js$/, '');
  if (options.candidate && !options.baseline) throw new Error('--candidate requires --baseline');
  if (options.baseline) {
    if (options.suite !== 'rayo' || options.mode !== 'single')
      throw new Error('Paired checkouts require --suite rayo --mode single');
    if (['rayo-path', 'send-path', 'compress-path'].some((key) => options[key]))
      throw new Error('Checkout comparison cannot be combined with entry-point overrides');
  }
  return options;
}

export function createPlan(options) {
  let plan;
  if (options.suite === 'compare') {
    const names =
      options.mode === 'cluster' ? ['RayoStorm'] : options.mode === 'all' ? [...frameworks, 'RayoStorm'] : frameworks;
    plan = names.map((framework) => ({
      framework,
      serverMode: framework === 'RayoStorm' ? 'cluster' : 'single',
      id: 'hello',
      path: '/hello',
      body: 'Thunderstruck... hello',
      status: 200
    }));
  } else {
    plan = workloads.map((workload) => ({
      ...workload,
      framework: options.mode === 'cluster' ? 'RayoStorm' : 'Rayo',
      serverMode: options.mode
    }));
  }
  if (options.only) plan = plan.filter((entry) => entry.framework === options.only);
  if (options.case) plan = plan.filter((entry) => entry.id === options.case || entry.id.startsWith(`${options.case}/`));
  if (!plan.length) throw new Error('No benchmarks match the requested suite, mode, framework and case');
  return plan;
}

// Fisher-Yates with a seeded PRNG makes the first order reproducible. Alternating
// forward/reverse order in subsequent rounds limits warm-machine order bias.
export function runOrder(plan, seed, round) {
  const order = [...plan];
  let state = seed >>> 0;
  for (let i = order.length - 1; i > 0; i -= 1) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const j = Math.floor((state / 4294967296) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return round % 2 ? order.reverse() : order;
}

export function validateResult(result, expectedStatus) {
  const allowed = new Set(Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]);
  const unexpected = Object.entries(result.statusCodeStats || {})
    .filter(([status]) => !allowed.has(Number(status)))
    .reduce((total, [, stats]) => total + stats.count, 0);
  const missing = [...allowed].filter((status) => !result.statusCodeStats?.[status]?.count);
  if (result.errors || result.timeouts || result.mismatches || unexpected || missing.length || !result.requests.total) {
    throw new Error(
      `Invalid run: ${result.errors} errors, ${result.timeouts} timeouts, ` +
        `${result.mismatches} body mismatches, ${unexpected} unexpected statuses, ` +
        `${missing.length} missing statuses, ${result.requests.total} responses`
    );
  }
}

function waitMessage(child, predicate, timeout = 10000) {
  return new Promise((yes, no) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const onMessage = (message) => {
      if (predicate(message)) {
        cleanup();
        yes(message);
      }
    };
    const onError = (error) => {
      cleanup();
      no(error);
    };
    const onExit = (code, signal) => onError(new Error(`Benchmark server exited (${signal || code})`));
    const timer = setTimeout(() => onError(new Error('Benchmark server IPC timed out')), timeout);
    child.on('message', onMessage).once('error', onError).once('exit', onExit);
  });
}

function signalTree(child, signal) {
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function stopServer(child) {
  if (!child.pid) return;
  // The detached process group includes Storm's workers, even if its primary died.
  signalTree(child, 'SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    let timer;
    await Promise.race([
      once(child, 'exit'),
      new Promise((yes) => {
        timer = setTimeout(yes, 2000);
      })
    ]).finally(() => clearTimeout(timer));
  }
  signalTree(child, 'SIGKILL');
}

async function sample(child, action) {
  const response = waitMessage(child, (message) => message.type === 'sample' && message.action === action);
  child.send({ type: 'sample', action });
  return response;
}

export async function probe(url, workload) {
  const response = await new Promise((yes, no) => {
    const req = request(url, { method: workload.method || 'GET', headers: workload.headers, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', no);
      res.on('end', () => yes({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('Response validation timed out')));
    req.on('error', no).end();
  });
  if (response.status !== workload.status) throw new Error(`Expected HTTP ${workload.status}, got ${response.status}`);
  const encoding = response.headers['content-encoding'];
  if ((workload.encoding || undefined) !== encoding) {
    throw new Error(`Expected content encoding ${workload.encoding || 'identity'}, got ${encoding || 'identity'}`);
  }
  const body =
    encoding === 'gzip'
      ? gunzipSync(response.body)
      : encoding === 'br'
        ? brotliDecompressSync(response.body)
        : response.body;
  if (body.toString() !== workload.body) throw new Error(`Unexpected response body for ${workload.id}`);
  return response;
}

export function requestsFor(workload) {
  return workload.requests || [workload];
}

// Autocannon associates each callback with its pipelined request, so mixed 200 /
// 404 traffic cannot hide a response delivered by the wrong route.
export function loadRequests(workload, invalid) {
  return requestsFor(workload).map((entry) => ({
    path: entry.path,
    method: entry.method || 'GET',
    headers: entry.headers,
    onResponse: (status, body) => {
      if (status !== entry.status || (!entry.encoding && body !== entry.body)) invalid();
    }
  }));
}

async function load(url, workload, options, duration) {
  const latency = build({
    lowestDiscernibleValue: 1,
    highestTrackableValue: 60000000,
    numberOfSignificantValueDigits: 3
  });
  let mismatches = 0;
  try {
    const result = await autocannon({
      url,
      connections: options.connections,
      pipelining: options.pipelining,
      duration,
      requests: loadRequests(workload, () => {
        mismatches += 1;
      }),
      // Autocannon converts compressed bytes to UTF-8 before this hook; validate
      // compressed bodies in binary-aware probes around each timed interval.
      setupClient: (client) =>
        client.on('response', (status, bytes, milliseconds) => {
          latency.recordValue(Math.max(1, Math.round(milliseconds * 1000)));
        })
    });
    result.mismatches += mismatches;
    validateResult(
      result,
      requestsFor(workload).map((entry) => entry.status)
    );
    return {
      ...result,
      latency: {
        ...result.latency,
        mean: latency.mean / 1000,
        p50: latency.getValueAtPercentile(50) / 1000,
        p95: latency.getValueAtPercentile(95) / 1000,
        p99: latency.getValueAtPercentile(99) / 1000
      }
    };
  } finally {
    latency.destroy();
  }
}

export async function runBenchmark(workload, options) {
  const mode = workload.serverMode || options.mode;
  const fixture = workload.framework === 'RayoStorm' || workload.framework === 'Rayo' ? 'Rayo' : workload.framework;
  const child = fork(resolve(base, 'compare', `${fixture}.js`), [], {
    detached: process.platform !== 'win32',
    env: { ...process.env, LOG_LEVEL: 'error', RAYO_BENCH: JSON.stringify({ ...options, mode, workload }) },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    execArgv: []
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8000);
  });
  const interrupted = () => signalTree(child, 'SIGTERM');
  process.on('SIGINT', interrupted).on('SIGTERM', interrupted);
  try {
    const ready = await waitMessage(child, (message) => message.type === 'ready');
    const url = `http://127.0.0.1:${ready.port}`;
    const validate = async () => {
      for (const entry of requestsFor(workload)) await probe(`${url}${entry.path}`, entry);
    };
    await validate();
    if (options.warmup) {
      await load(url, workload, options, options.warmup);
      await validate();
    }
    const start = await sample(child, 'start');
    const result = await load(url, workload, options, options.duration);
    const finish = await sample(child, 'finish');
    await validate();
    const elapsedMicros = (finish.time - start.time) / 1000;
    const cpuMicros = finish.cpu - start.cpu;
    return {
      framework: workload.framework,
      case: workload.id,
      mode,
      serverWorkers: mode === 'cluster' ? options['server-workers'] : 1,
      versions: ready.versions,
      requestsPerSecond: result.requests.average,
      peakRequestsPerSecond: result.requests.max,
      latency: {
        mean: result.latency.mean,
        p50: result.latency.p50,
        p95: result.latency.p95,
        p99: result.latency.p99
      },
      throughputBytesPerSecond: result.throughput.average,
      cpuPercent: (cpuMicros / elapsedMicros) * 100,
      peakRssBytes: finish.peakRss,
      heapUsedBytes: finish.heapUsed,
      errors: result.errors,
      timeouts: result.timeouts,
      mismatches: result.mismatches,
      statusCodeStats: result.statusCodeStats,
      requests: result.requests.total,
      duration: result.duration
    };
  } catch (error) {
    throw new Error(`${workload.framework}/${workload.id}: ${error.message}${stderr ? `\n${stderr}` : ''}`, {
      cause: error
    });
  } finally {
    process.off('SIGINT', interrupted).off('SIGTERM', interrupted);
    await stopServer(child);
  }
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function spread(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Statistics require finite samples');
  return { median: median(values), min: Math.min(...values), max: Math.max(...values) };
}

export function pairResult(baseline, candidate) {
  if (baseline.case !== candidate.case || baseline.mode !== candidate.mode)
    throw new Error('Paired runs must measure the same case and mode');
  const difference = (before, after) => (before === 0 ? null : (after / before - 1) * 100);
  return {
    case: baseline.case,
    changePercent: {
      requestsPerSecond: difference(baseline.requestsPerSecond, candidate.requestsPerSecond),
      latencyP50: difference(baseline.latency.p50, candidate.latency.p50),
      latencyP95: difference(baseline.latency.p95, candidate.latency.p95),
      latencyP99: difference(baseline.latency.p99, candidate.latency.p99),
      cpuPercent: difference(baseline.cpuPercent, candidate.cpuPercent),
      peakRssBytes: difference(baseline.peakRssBytes, candidate.peakRssBytes)
    }
  };
}

export function summarizePairs(pairs) {
  return [...new Set(pairs.map((pair) => pair.case))].map((id) => {
    const group = pairs.filter((pair) => pair.case === id);
    return {
      case: id,
      pairs: group.length,
      changePercent: Object.fromEntries(
        Object.keys(group[0].changePercent).map((metric) => {
          const values = group.map((pair) => pair.changePercent[metric]).filter((value) => value !== null);
          return [metric, values.length ? spread(values) : null];
        })
      )
    };
  });
}

export function checkoutOptions(directory, options) {
  const root = realpathSync(resolve(directory));
  return {
    ...options,
    'rayo-path': resolve(root, 'packages/rayo/index.js'),
    'send-path': resolve(root, 'packages/send/index.js'),
    'compress-path': resolve(root, 'packages/compress/index.js')
  };
}

export function sourceMetadata(directory) {
  const root = realpathSync(resolve(directory));
  let commit = null;
  let trackedChanges = null;
  try {
    commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    trackedChanges = execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8'
    }).trim();
  } catch {
    /* A source snapshot can be measured without Git metadata. */
  }
  const files = {};
  for (const pkg of ['rayo', 'send', 'compress', 'storm']) {
    const directory = resolve(root, 'packages', pkg);
    for (const name of readdirSync(directory).sort()) {
      if (!/\.(?:m?js|json)$/.test(name) || /\.old\.| copy\./.test(name)) continue;
      files[`packages/${pkg}/${name}`] = createHash('sha256')
        .update(readFileSync(resolve(directory, name)))
        .digest('hex');
    }
  }
  return { directory: root, commit, trackedChanges, sha256: files };
}

export async function compareCheckouts(
  plan,
  options,
  { run = runBenchmark, progress = () => {}, save = () => {} } = {}
) {
  if (options.suite !== 'rayo' || options.mode !== 'single') {
    throw new Error('Paired checkouts require --suite rayo --mode single');
  }
  const variants = {
    baseline: checkoutOptions(options.baseline, options),
    candidate: checkoutOptions(options.candidate || resolve(base, '../..'), options)
  };
  const report = { complete: false, runs: [], pairs: [], summary: [] };
  for (let round = 0; round < options.repeats; round += 1) {
    for (const workload of runOrder(plan, options.seed, round)) {
      const measured = {};
      const order = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
      for (const variant of order) {
        progress(`Pair ${round + 1}/${options.repeats}: ${workload.id} / ${variant}`);
        measured[variant] = { round: round + 1, variant, ...(await run(workload, variants[variant])) };
        report.runs.push(measured[variant]);
        save(report);
      }
      report.pairs.push({ round: round + 1, order, ...pairResult(measured.baseline, measured.candidate) });
      report.summary = summarizePairs(report.pairs);
      save(report);
    }
  }
  report.complete = true;
  save(report);
  return report;
}

export function machineMetadata(options) {
  return {
    node: process.version,
    platform: platform(),
    architecture: arch(),
    cpu: cpus()[0]?.model,
    availableParallelism: availableParallelism(),
    startedAt: new Date().toISOString(),
    options
  };
}

export function comparisonTable(runs) {
  const summaries = [...new Set(runs.map((run) => run.framework))].map((framework) => {
    const group = runs.filter((run) => run.framework === framework);
    const average = (metric) => group.reduce((total, run) => total + metric(run), 0) / group.length;
    const first = group[0];
    return {
      framework: framework === 'RayoStorm' ? 'Storm' : framework,
      version: first.versions[framework === 'RayoStorm' ? '@rayo/storm' : framework.toLowerCase()],
      workers: first.serverWorkers,
      peak: Math.max(...group.map((run) => run.peakRequestsPerSecond)),
      average: average((run) => run.requestsPerSecond),
      latency: average((run) => run.latency.mean),
      throughput: average((run) => run.throughputBytesPerSecond)
    };
  });
  summaries.sort((left, right) => right.average - left.average);
  const table = new Table({
    head: ['Framework', 'Version', 'Workers', 'Reqs/sec ^', 'Reqs/sec *', 'Latency *', 'Throughput *']
  });
  for (const row of summaries) {
    table.push([
      row.framework,
      row.version,
      row.workers,
      row.peak,
      row.average.toFixed(1),
      `${row.latency.toFixed(2)} ms`,
      `${(row.throughput / 1024 / 1024).toFixed(2)} MiB/s`
    ]);
  }
  return (
    `\n${table}\n^ Highest one-second request sample across runs. * Mean of per-run averages.\n` +
    'Storm runs Rayo with the listed number of server workers; other frameworks use one.\n'
  );
}

function printResults(runs, plan, options) {
  if (options.mode === 'all') {
    process.stdout.write(comparisonTable(runs));
    return;
  }
  const table = new Table({
    head: ['Framework / case', 'Version', 'Req/sec', 'p50 ms', 'p95 ms', 'p99 ms', 'CPU %', 'RSS MiB']
  });
  for (const entry of plan) {
    const group = runs.filter((run) => run.framework === entry.framework && run.case === entry.id);
    const metric = (key) => median(group.map((run) => run[key]));
    const percentile = (key) => median(group.map((run) => run.latency[key])).toFixed(2);
    const versions = group[0].versions;
    const version = versions[entry.framework.toLowerCase()] || versions.rayo;
    table.push([
      `${entry.framework} / ${entry.id}`,
      version,
      Math.round(metric('requestsPerSecond')),
      percentile('p50'),
      percentile('p95'),
      percentile('p99'),
      metric('cpuPercent').toFixed(1),
      (metric('peakRssBytes') / 1024 / 1024).toFixed(1)
    ]);
  }
  process.stdout.write(
    `\n${table.toString()}\nValues are medians across runs; percentile columns are medians of per-run percentiles.\n`
  );
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(readFileSync(resolve(base, 'help.txt'), 'utf8'));
    return;
  }
  const plan = createPlan(options);
  if (options.list) {
    process.stdout.write(`${plan.map((entry) => `${entry.framework}\t${entry.id}`).join('\n')}\n`);
    return;
  }
  const metadata = machineMetadata(options);
  process.stdout.write(
    `${options.mode} servers; ${options.connections} connections; pipelining ${options.pipelining}; ` +
      `one load process; ${options.repeats} repeats (${options.warmup}s warmup + ${options.duration}s measured each).\n`
  );
  if (options.baseline) {
    metadata.sources = {
      baseline: sourceMetadata(options.baseline),
      candidate: sourceMetadata(options.candidate || resolve(base, '../..'))
    };
    metadata.workloads = plan;
    const report = await compareCheckouts(plan, options, {
      progress: (message) => process.stdout.write(`${message}\n`),
      save: (report) => {
        if (options.output)
          writeFileSync(resolve(options.output), `${JSON.stringify({ metadata, ...report }, null, 2)}\n`);
      }
    });
    const table = new Table({ head: ['Case', 'Pairs', 'Req/sec change %', 'Pair range %', 'p99 change %'] });
    for (const summary of report.summary) {
      const throughput = summary.changePercent.requestsPerSecond;
      table.push([
        summary.case,
        summary.pairs,
        throughput.median.toFixed(2),
        `${throughput.min.toFixed(2)} to ${throughput.max.toFixed(2)}`,
        summary.changePercent.latencyP99?.median.toFixed(2) || 'n/a'
      ]);
    }
    process.stdout.write(
      `\n${table}\nChanges are candidate relative to baseline, paired within each round. ` +
        'Ranges are observed samples, not confidence intervals.\n'
    );
    return;
  }
  const runs = [];
  for (let round = 0; round < options.repeats; round += 1) {
    for (const workload of runOrder(plan, options.seed, round)) {
      process.stdout.write(`Round ${round + 1}/${options.repeats}: ${workload.framework} / ${workload.id}\n`);
      runs.push({ round: round + 1, ...(await runBenchmark(workload, options)) });
      if (options.output) writeFileSync(resolve(options.output), `${JSON.stringify({ metadata, runs }, null, 2)}\n`);
    }
  }
  printResults(runs, plan, options);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
