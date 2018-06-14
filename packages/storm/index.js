const cluster = require('cluster');
const cpus = require('os').cpus();
const { log, monitor, messageHandler } = require('./monitor');

class Storm {
  constructor(work, options) {
    if (!work || typeof work !== 'function') {
      throw new Error('You need to provide a worker function.');
    }

    this.keepAlive = options.keepAlive === undefined ? true : options.keepAlive;
    this.monitor = options.monitor === undefined ? true : options.monitor;
    this.work = work.bind(this);
    this.fork = this.fork.bind(this);
    this.stop = this.stop.bind(this);
    this.start(options);
  }

  start(options) {
    if (cluster.isWorker) {
      this.work();
      messageHandler.bind(null, process)();
    } else {
      cluster.on('exit', this.fork);
      process.on('SIGINT', this.stop).on('SIGTERM', this.stop);

      let processes = options.workers || cpus.length;
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
        monitor.start(cluster, options.monitorPort);
      }
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

    log.info('The cluster has been terminated by the system.');
    process.exit();
  }

  fork(worker, code) {
    if (this.keepAlive) {
      log.warn(`Worker ${worker.process.pid} died. Code: ${code}`);
      cluster.fork();
    }

    if (!Object.keys(cluster.workers).length) {
      monitor.stop();
    }
  }
}

exports.Storm = Storm;
exports.storm = (work = null, options = {}) => new Storm(work, options);
