const pino = require('pino');
const rayo = require('rayo');
const send = require('@rayo/send');

const { STORM_LOG_NAME = 'Rayo', STORM_LOG_LEVEL = 'info' } = process.env;
const log = pino({ name: STORM_LOG_NAME, level: STORM_LOG_LEVEL, prettyPrint: true });
const round = (number) => Math.round(number * 100) / 100;
const reform = (item) => {
  item.upTime = item.upTime ? Math.floor(item.upTime) : undefined;
  item.cpuTime = item.cpuTime
    ? round((item.cpuTime.user + item.cpuTime.system) / 1e6)
    : undefined;

  if (item.memory) {
    const keys = Object.keys(item.memory);
    for (let k = 0; k < keys.length; k += 1) {
      item.memory[keys[k]] = round(item.memory[keys[k]] / 1024 / 1024);
    }
  }
  return item;
};
const pre = (payload) => (Array.isArray(payload) ? payload.map(reform) : reform(payload));
const requestHandler = (cluster, req, res) => {
  const workerId = parseInt(req.params.worker, 10) || null;
  if (workerId) {
    const worker = cluster.workers[workerId];
    if (!worker) {
      return res.send(`Worker ${req.params.worker} does not exist.`);
    }

    worker.once('message', (message) => res.send(pre(message)));
    return worker.send(req.params.cmd || 'health');
  }

  const current = [];
  Object.keys(cluster.workers).forEach((worker) =>
    current.push({
      id: cluster.workers[worker].id,
      pid: cluster.workers[worker].process.pid,
      ppid: cluster.masterPid,
      status: cluster.workers[worker].state
    })
  );

  return res.send(pre(current));
};

module.exports = {
  log,

  messageHandler: (process) => {
    // The `master` process sent this message/command to the worker.
    process.on('message', (cmd) => {
      log.info(`Worker (${process.pid}) received a message: ${cmd}.`);
      let response = null;
      switch (cmd) {
        case 'health':
          response = {
            pid: process.pid,
            ppid: process.ppid,
            platform: process.platform,
            upTime: process.uptime(),
            cpuTime: process.cpuUsage(),
            memory: process.memoryUsage()
          };
          break;
        default:
      }

      return response ? process.send(pre(response)) : null;
    });
  },

  monitor: {
    start: (cluster, port = null) => {
      this.httpServer = rayo({ port, cluster: false })
        .through(send())
        .get('/monitor/:worker?/:cmd?', requestHandler.bind(null, cluster))
        .start((address) => {
          log.info(
            `Monitoring ${Object.keys(cluster.workers).length} workers on port ${
              address.port
            }`
          );
        });
    },

    stop: () => {
      if (this.httpServer) {
        this.httpServer.close();
        log.info('Monitoring has been stopped.');
      }
    }
  }
};
