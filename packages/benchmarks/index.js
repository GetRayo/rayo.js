#!/usr/bin/env node

import { fork } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
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
  if (!['single', 'cluster'].includes(options.mode)) throw new Error('--mode must be single or cluster');
  if (options.only) options.only = options.only.replace(/\.js$/, '');
  return options;
}

export function createPlan(options) {
  let plan;
  if (options.suite === 'compare') {
    const names = options.mode === 'cluster' ? ['RayoStorm'] : frameworks;
    plan = names.map((framework) => ({
      framework,
      id: 'hello',
      path: '/hello',
      body: 'Thunderstruck... hello',
      status: 200
    }));
  } else {
    plan = workloads.map((workload) => ({ ...workload, framework: options.mode === 'cluster' ? 'RayoStorm' : 'Rayo' }));
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
  const unexpected = Object.entries(result.statusCodeStats || {})
    .filter(([status]) => Number(status) !== expectedStatus)
    .reduce((total, [, stats]) => total + stats.count, 0);
  if (result.errors || result.timeouts || result.mismatches || unexpected || !result.requests.total) {
    throw new Error(
      `Invalid run: ${result.errors} errors, ${result.timeouts} timeouts, ` +
        `${result.mismatches} body mismatches, ${unexpected} unexpected statuses, ${result.requests.total} responses`
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
    const req = request(url, { headers: workload.headers, agent: false }, (res) => {
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

async function load(url, workload, options, duration) {
  const latency = build({
    lowestDiscernibleValue: 1,
    highestTrackableValue: 60000000,
    numberOfSignificantValueDigits: 3
  });
  try {
    const result = await autocannon({
      url,
      connections: options.connections,
      pipelining: options.pipelining,
      duration,
      headers: workload.headers,
      // Autocannon converts compressed bytes to UTF-8 before this hook; validate
      // compressed bodies in binary-aware probes around each timed interval.
      ...(workload.encoding ? {} : { verifyBody: (body) => body === workload.body }),
      setupClient: (client) =>
        client.on('response', (status, bytes, milliseconds) => {
          latency.recordValue(Math.max(1, Math.round(milliseconds * 1000)));
        })
    });
    validateResult(result, workload.status);
    return {
      ...result,
      latency: {
        ...result.latency,
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
  const fixture = workload.framework === 'RayoStorm' || workload.framework === 'Rayo' ? 'Rayo' : workload.framework;
  const child = fork(resolve(base, 'compare', `${fixture}.js`), [], {
    detached: process.platform !== 'win32',
    env: { ...process.env, LOG_LEVEL: 'error', RAYO_BENCH: JSON.stringify({ ...options, workload }) },
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
    const url = `http://127.0.0.1:${ready.port}${workload.path}`;
    await probe(url, workload);
    if (options.warmup) {
      await load(url, workload, options, options.warmup);
      await probe(url, workload);
    }
    const start = await sample(child, 'start');
    const result = await load(url, workload, options, options.duration);
    const finish = await sample(child, 'finish');
    await probe(url, workload);
    const elapsedMicros = (finish.time - start.time) / 1000;
    const cpuMicros = finish.cpu - start.cpu;
    return {
      framework: workload.framework,
      case: workload.id,
      mode: options.mode,
      versions: ready.versions,
      requestsPerSecond: result.requests.average,
      latency: { p50: result.latency.p50, p95: result.latency.p95, p99: result.latency.p99 },
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

function printResults(runs, plan) {
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
  const metadata = {
    node: process.version,
    platform: platform(),
    architecture: arch(),
    cpu: cpus()[0]?.model,
    availableParallelism: availableParallelism(),
    startedAt: new Date().toISOString(),
    options
  };
  process.stdout.write(
    `${options.mode} servers; ${options.connections} connections; pipelining ${options.pipelining}; ` +
      `one load process; ${options.repeats} repeats (${options.warmup}s warmup + ${options.duration}s measured each).\n`
  );
  const runs = [];
  for (let round = 0; round < options.repeats; round += 1) {
    for (const workload of runOrder(plan, options.seed, round)) {
      process.stdout.write(`Round ${round + 1}/${options.repeats}: ${workload.framework} / ${workload.id}\n`);
      runs.push({ round: round + 1, ...(await runBenchmark(workload, options)) });
      if (options.output) writeFileSync(resolve(options.output), `${JSON.stringify({ metadata, runs }, null, 2)}\n`);
    }
  }
  printResults(runs, plan);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
