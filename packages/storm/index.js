import cluster from 'cluster';
import EventEmitter from 'events';
import { availableParallelism } from 'node:os';
import log from './log.mjs';
import monitor from './monitor.mjs';

class Storm extends EventEmitter {
  constructor(work, options = {}) {
    super();
    if (!work || typeof work !== 'function') {
      throw new Error('You need to provide a worker function.');
    }

    if (!['number', 'string', 'undefined'].includes(typeof options.workers)) {
      throw new RangeError('The worker count must be a positive integer, or 0 for automatic selection.');
    }
    const workers =
      options.workers === undefined || options.workers === 0 || options.workers === '0'
        ? availableParallelism()
        : Number(options.workers);
    if (!Number.isSafeInteger(workers) || workers < 1) {
      throw new RangeError('The worker count must be a positive integer, or 0 for automatic selection.');
    }
    this.workers = workers;

    this.keepAlive = options.keepAlive === undefined ? true : options.keepAlive;
    this.monitor = options.monitor === undefined ? true : options.monitor;
    this.work = work.bind(this);
    this.fork = this.fork.bind(this);
    this.stop = this.stop.bind(this);

    if (cluster.isPrimary) {
      cluster.setupPrimary({
        silent: false,
        schedulingPolicy: cluster.SCHED_RR
      });
    }

    if (cluster.isWorker) {
      this.work();
      monitor.messageHandler.bind(null, process)();
    } else {
      this.start(options);
    }
  }

  start(options) {
    process.on('SIGINT', this.stop).on('SIGTERM', this.stop);
    cluster.on('online', (wrk) => {
      log.debug(`Worker ${wrk.process.pid} is online`);
      this.emit('worker', wrk.process.pid);
    });
    cluster.on('exit', (wrk) => {
      this.emit('exit', wrk.process.pid);
      return this.fork(wrk);
    });

    log.debug(`Master (${process.pid}) is forking ${this.workers} workers.`);
    for (let index = 0; index < this.workers; index += 1) {
      cluster.fork();
    }

    cluster.masterPid = process.pid;
    if (options.master) {
      log.debug(`Master process: ${process.pid}`);
      options.master.call(this, cluster);
    }

    if (this.monitor) {
      monitor.service.start(cluster, options);
    }
  }

  stop() {
    monitor.service.stop();
    this.keepAlive = false;
    const workers = Object.values(cluster.workers);
    workers.forEach((worker) => {
      if (worker) {
        worker.process.kill();
        worker.kill();
      }
    });

    log.debug('The cluster has been terminated.');
    this.emit('offline');
    setTimeout(process.exit, 200);
  }

  fork(wrk) {
    if (this.keepAlive) {
      const worker = cluster.fork();
      log.warn(`Worker ${wrk.process.pid} died. Replacer: ${worker.process.pid}`);
    }

    if (!Object.keys(cluster.workers).length) {
      monitor.service.stop();
    }
  }
}

export default Storm;
export function storm(work = null, options = {}) {
  return new Storm(work, options);
}
