import parseurl from 'parseurl';
import { createServer } from 'http';
import log from './log.mjs';

const round = (number) => Math.round(number * 100) / 100;
const reform = (item) => {
  item.upTime = item.upTime ? Math.floor(item.upTime) : undefined;
  item.cpuTime = item.cpuTime ? round((item.cpuTime.user + item.cpuTime.system) / 1e6) : undefined;

  if (item.memory) {
    const keys = Object.keys(item.memory);
    for (let k = 0; k < keys.length; k += 1) {
      item.memory[keys[k]] = round(item.memory[keys[k]] / 1024 / 1024);
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
const requestDispatch = (cluster, res, { workerId, command }) => {
  if (workerId) {
    const worker = cluster.workers[workerId];

    if (!worker) {
      res.setHeader('Content-Type', 'text/plain');
      return send(res, `Worker ${workerId} does not exist.`);
    }

    res.setHeader('Content-Type', 'application/json');
    worker.once('message', (message) => send(res, JSON.stringify(pre(message))));
    return worker.send(command);
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

  res.setHeader('Content-Type', 'application/json');
  return send(res, JSON.stringify(pre(current)));
};
const requestHandler = (cluster, req, res) => {
  const { pathname } = parseurl(req);
  const [service, workerId, command = 'health'] = pathname.substring(1, pathname.length).split('/');

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

let httpServer = null;
const monitor = {
  log,
  messageHandler: (process) => {
    // The `master` process sent this message/command to the worker.
    process.on('message', (cmd) => {
      log.debug(`Worker (${process.pid}) received a message: ${cmd}.`);
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
  service: {
    start: function start(cluster, { monitorPort = null, server = createServer() }) {
      httpServer = server;
      httpServer.listen(monitorPort);
      httpServer.on('request', requestHandler.bind(null, cluster));
      httpServer.on('listening', () => {
        log.debug(
          `Monitoring ${Object.keys(cluster.workers).length} workers on port ${httpServer.address().port}`
        );
      });
    },
    stop: function stop() {
      if (httpServer) {
        httpServer.close();
        log.debug('Monitoring has been stopped.');
      }
    }
  }
};

export default monitor;
