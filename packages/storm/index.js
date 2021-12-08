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

    this.keepAlive = !!options.keepAlive;
    this.work = work.bind(this);
    this.fork = this.fork.bind(this);
    this.stop = this.stop.bind(this);

    if (cluster.isMaster) {
      cluster.setupMaster({ silent: true });
      // Is the process from the master process needs to be piped into the workers.
      // cluster.fork().process.stdout.pipe(process.stdout);
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
      log.info(`Worker ${wrk.process.pid} is online`);
      this.emit('worker', wrk.process.pid);
    });
    cluster.on('exit', (wrk) => {
      this.emit('exit', wrk.process.pid);
      return this.fork(wrk);
    });

    log.info(`Master (${process.pid}) is forking ${processes} workers.`);
    while (processes) {
      processes -= 1;
      cluster.fork();
    }

    cluster.masterPid = process.pid;
    cluster.platform = process.platform;
    if (options.master) {
      log.info(`Master process: ${process.pid}`);
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
    setTimeout(process.exit, 200);
  }

  fork(wrk) {
    if (this.keepAlive) {
      const worker = cluster.fork();
      log.warn(`Worker ${wrk.process.pid} died. Replacer: ${worker.process.pid}`);
    }

    if (!Object.keys(cluster.workers).length) {
      monitor.stop();
    }
  }
}

module.exports.Storm = Storm;
module.exports.storm = (work = null, options = {}) => new Storm(work, options);
