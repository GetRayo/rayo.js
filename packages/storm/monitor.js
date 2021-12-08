const parseurl = require('parseurl');
const { createServer } = require('http');
const log = require('./log');

const round = (number) => Math.round(number * 100) / 100;
const reform = (item) => {
  item.upTime = item.upTime ? Math.floor(item.upTime) : undefined;
  if (item.cpuTime) {
    item.cpuTime.total = round((item.cpuTime.user + item.cpuTime.system) / 1e6);
  }

  if (item.memory) {
    const keys = Object.keys(item.memory);
    for (let k = 0; k < keys.length; k += 1) {
      item.memory[keys[k]] = round(item.memory[keys[k]] / 1024);
    }
  }
  return item;
};
const pre = (payload) => (Array.isArray(payload) ? payload.map(reform) : reform(payload));
const send = (res, data) => {
  res.setHeader('Content-Length', data.length);
  res.setHeader('X-Powered-by', '@rayo/storm');
  res.end(data);
};
const getWorker = (cluster, pid) => {
  const workers = Object.values(cluster.workers);
  let items = workers.length;
  while (items) {
    items -= 1;
    if (workers[items].process.pid === pid) {
      return workers[items];
    }
  }

  return false;
};
const requestDispatch = (cluster, res, { workerId, command }) => {
  if (workerId) {
    const worker = getWorker(cluster, workerId);
    if (!worker) {
      res.setHeader('Content-Type', 'text/plain');
      return send(res, `Worker ${workerId} does not exist.`);
    }

    res.setHeader('Content-Type', 'application/json');
    worker.once('message', (message) => send(res, JSON.stringify(pre(message))));
    return worker.send(command);
  }

  res.setHeader('Content-Type', 'application/json');
  return send(
    res,
    JSON.stringify(
      pre({
        parent: cluster.masterPid,
        platform: cluster.platform,
        workers: Object.entries(cluster.workers).map(([, worker]) => ({
          pid: worker.process.pid,
          status: worker.state
        }))
      })
    )
  );
};
const requestHandler = (cluster, req, res) => {
  const { pathname } = parseurl(req);
  const [service, workerId, command = 'health'] = pathname
    .substr(1, pathname.length)
    .split('/');

  if (service === 'monitor') {
    return requestDispatch.bind(
      null,
      cluster,
      res
    )({
      workerId: parseInt(workerId, 10) || null,
      command
    });
  }

  res.statusCode = 404;
  return res.end('This service does not exist.');
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
    start: (cluster, { monitorPort = null, server = createServer() }) => {
      this.httpServer = server;
      this.httpServer.listen(monitorPort);
      this.httpServer.on('request', requestHandler.bind(null, cluster));
      this.httpServer.on('listening', () => {
        log.info(
          `Monitoring ${Object.keys(cluster.workers).length} workers on port ${
            this.httpServer.address().port
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
