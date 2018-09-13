const cluster = require('cluster');
const EventEmitter = require('events');
const cpus = require('os').cpus();
const { log, monitor, messageHandler } = require('./monitor');

class Storm extends EventEmitter {
  constructor(work, options) {
    super();
    if (!work || typeof work !== 'function') {
      throw new Error('You need to provide a worker function.');
    }

    this.keepAlive = options.keepAlive === undefined ? true : options.keepAlive;
    this.monitor = options.monitor === undefined ? true : options.monitor;
    this.work = work.bind(this);
    this.fork = this.fork.bind(this);
    this.stop = this.stop.bind(this);

    if (cluster.isWorker) {
      this.work();
      return messageHandler.bind(null, process)();
    }

    return this.start(options);
  }

  start(options) {
    let processes = options.workers || cpus.length;
    process.on('SIGINT', this.stop).on('SIGTERM', this.stop);
    cluster.on('online', (wrk) => {
      this.emit('worker', wrk.process.pid);
      log.info(`Worker ${wrk.process.pid} is online`);
    });
    cluster.on('exit', (wrk) => {
      this.emit('exit', wrk.process.pid);
      return this.fork();
    });

    log.info(`Master (${process.pid}) is forking ${processes} worker processes.`);
    while (processes) {
      processes -= 1;
      cluster.fork();
    }

    cluster.masterPid = process.pid;
    if (options.master) {
      options.master = options.master.bind(this, cluster);
      options.master();
    }

    if (this.monitor) {
      monitor.start(cluster, options);
    }
  }

  stop() {
    monitor.stop();
    this.keepAlive = false;
    let index = Object.keys(cluster.workers).length;
    while (index) {
      if (cluster.workers[index]) {
        cluster.workers[index].process.kill();
        cluster.workers[index].kill();
      }
      index -= 1;
    }

    log.info('The cluster has been terminated.');
    this.emit('offline');
    process.exit();
  }

  fork(worker, code) {
    if (this.keepAlive) {
      const wrk = cluster.fork();
      log.warn(
        `Worker ${worker.process.pid} died (${code}). Replace: ${wrk.process.pid}`
      );
    }

    if (!Object.keys(cluster.workers).length) {
      monitor.stop();
    }
  }
}

module.exports.Storm = Storm;
module.exports.storm = (work = null, options = {}) => new Storm(work, options);
