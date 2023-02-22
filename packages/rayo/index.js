import http from 'http';
import parseurl from 'parseurl';
import { parse } from 'querystring';
import { storm } from '@rayo/storm';
import Bridge from './bridge.mjs';

const ip = (req) => {
  const { headers = {}, connection = {}, socket = {} } = req;
  const remoteAddress = connection.remoteAddress || socket.remoteAddress;
  const socketAddress = connection.socket ? connection.socket.remoteAddress : null;

  return headers['x-forwarded-for'] || remoteAddress || socketAddress;
};
const end = (req, res, status, message) => {
  res.statusCode = status;
  res.setHeader('Content-Length', message.length);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
};

class Rayo extends Bridge {
  constructor(options) {
    super();
    ({
      host: this.host,
      port: this.port,
      storm: this.stormOptions = null,
      onError: this.onError = null,
      notFound: this.notFound = null,
      server: this.server = null
    } = options);
    this.dispatch = this.dispatch.bind(this);
  }

  start(callback = function cb() {}) {
    const work = () => {
      this.server = this.server || http.createServer();
      this.server.listen(this.port, this.host);
      this.server.on('request', this.dispatch);
      this.server.once('listening', () => {
        this.through();
        const address = this.server.address();
        address.workerPid = process.pid;
        callback(address);
      });
    };

    if (this.stormOptions) {
      storm(work, this.stormOptions);
    } else {
      work();
    }

    return this.server;
  }

  dispatch(req, res) {
    const parsedUrl = parseurl(req);
    req.ip = ip(req);
    req.pathname = parsedUrl.pathname;
    req.query = parse(parsedUrl.query);

    let stack;
    const route = this.fetch(req.method, parsedUrl.pathname);
    if (!route) {
      stack = [this.notFound || (() => end(req, res, 404, `${req.method} ${parsedUrl.pathname} is undefined.`))];
    } else {
      req.params = route.params;
      ({ stack } = route);
    }

    return this.step(req, res, this.gates.concat(stack));
  }

  step(req, res, stack, error = null, statusCode = 400) {
    const fn = stack.shift();
    if (error) {
      return this.onError ? this.onError(error, req, res, fn) : end(req, res, statusCode, error);
    }

    if (fn) {
      return fn(req, res, this.step.bind(this, req, res, stack));
    }

    throw new Error('No handler to move to, the stack is empty.');
  }
}

export default function rayo(options = {}) {
  return new Rayo(options);
}
