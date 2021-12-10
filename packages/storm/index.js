const cluster = require('cluster');
const EventEmitter = require('events');
const cpus = require('os').cpus();
const log = require('./log');
const { monitor, messageHandler } = require('./monitor');

class Storm extends EventEmitter {
  constructor(work, options) {
    super();
    if (!work || typeof work !== 'function') {
      throw new Error('You need to provide a worker function.');
    }

    this.keepAlive = options.keepAlive === undefined || options.keepAlive;
    this.work = work.bind(this);
    this.fork = this.fork.bind(this);
    this.stop = this.stop.bind(this);

    if (cluster.isMaster) {
      // cluster.setupPrimary();
    }

    if (cluster.isWorker) {
      this.work();
      messageHandler.bind(null, process)();
    } else {
      this.start(options);
    }
  }

  start(options) {
    let processes = options.workers || cpus.length;
    process.on('SIGINT', this.stop).on('SIGTERM', this.stop);
    cluster.on('online', (wrk) => {
      log.debug(`Worker ${wrk.process.pid} is online`);
      this.emit('worker', wrk.process.pid);
    });

    cluster.on('exit', (wrk, code, signal) => {
      log.debug(`Worker ${wrk.process.pid} has exited`);
      this.emit('exit', wrk.process.pid);
      if (signal !== 'SIGTERM') {
        this.fork(wrk.process.pid);
      }
    });

    log.debug(`The master process (${process.pid}) will spawn ${processes} workers.`);
    while (processes) {
      processes -= 1;
      cluster.fork();
    }

    cluster.masterPid = process.pid;
    cluster.platform = process.platform;
    if (options.master) {
      log.debug(`Master process: ${process.pid}`);
      options.master = options.master.bind(this, cluster);
      options.master();
    }

    if (options.monitor) {
      monitor.start(cluster, options);
    }
  }

  stop() {
    monitor.stop();
    this.keepAlive = false;
    let items = Object.keys(cluster.workers).length;
    while (items) {
      if (cluster.workers[items]) {
        process.kill(cluster.workers[items].process.pid);
      }
      items -= 1;
    }

    log.debug('The cluster has been terminated.');
    this.emit('offline');
    setTimeout(process.exit, 200);
  }

  fork(pid) {
    if (this.keepAlive) {
      const worker = cluster.fork();
      log.warn(`Worker ${pid} died. Replacer: ${worker.process.pid}`);
    }
  }
}

module.exports.Storm = Storm;
module.exports.storm = (work = null, options = {}) => new Storm(work, options);
