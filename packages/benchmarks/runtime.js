import cluster from 'node:cluster';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
export const config = JSON.parse(process.env.RAYO_BENCH || '{}');

export async function loadPackage(name, override) {
  return import(override ? pathToFileURL(override).href : name);
}

export function versionOf(name, override) {
  let directory = dirname(override || require.resolve(name));
  while (true) {
    try {
      const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
      if (pkg.version) return pkg.version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Cannot find installed version of ${name}`);
    directory = parent;
  }
}

export function dependencyVersion(name, parent, override) {
  // Node resolves dependencies from the selected module's real location, even
  // when the entry-point override reaches that module through a symlink.
  const entry = realpathSync(override || require.resolve(parent));
  const resolveFromParent = createRequire(entry);
  return versionOf(name, resolveFromParent.resolve(name));
}

let peakRss = 0;
let sampling;
function snapshot(action) {
  const memory = process.memoryUsage();
  if (action === 'start') {
    peakRss = memory.rss;
    clearInterval(sampling);
    sampling = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage.rss());
    }, 50);
    sampling.unref();
  }
  peakRss = Math.max(peakRss, memory.rss);
  if (action === 'finish') clearInterval(sampling);
  const cpu = process.cpuUsage();
  return { cpu: cpu.user + cpu.system, peakRss, heapUsed: memory.heapUsed, time: Number(process.hrtime.bigint()) };
}

function send(message) {
  if (process.connected) process.send(message);
}

export function ready(server, versions) {
  const shutdown = () => {
    clearInterval(sampling);
    server.closeAllConnections?.();
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown).once('SIGINT', shutdown).once('disconnect', shutdown);
  process.on('message', (message) => {
    if (message.type === 'sample') send({ type: 'sample', action: message.action, ...snapshot(message.action) });
  });
  if (!cluster.isWorker) send({ type: 'ready', port: server.address().port, versions });
}

export function readyCluster(versions) {
  const listening = new Set();
  cluster.on('listening', (worker, address) => {
    listening.add(worker.id);
    if (listening.size === config['server-workers']) send({ type: 'ready', port: address.port, versions });
  });
  process.on('message', async (message) => {
    if (message.type !== 'sample') return;
    const workers = Object.values(cluster.workers);
    const samples = await Promise.all(
      workers.map(
        (worker) =>
          new Promise((yes) => {
            const receive = (response) => {
              if (response.type === 'sample' && response.action === message.action) {
                worker.off('message', receive);
                yes(response);
              }
            };
            worker.on('message', receive);
            worker.send(message);
          })
      )
    );
    const own = snapshot(message.action);
    send({
      type: 'sample',
      action: message.action,
      time: own.time,
      cpu: own.cpu + samples.reduce((total, sample) => total + sample.cpu, 0),
      peakRss: own.peakRss + samples.reduce((total, sample) => total + sample.peakRss, 0),
      heapUsed: own.heapUsed + samples.reduce((total, sample) => total + sample.heapUsed, 0)
    });
  });
  process.once('disconnect', () => process.kill(process.pid, 'SIGTERM'));
}
