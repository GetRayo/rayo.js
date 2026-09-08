import http from 'http';
import { storm } from '@rayo/storm';
import Bridge from './bridge.mjs';
import parseRequest from './request.mjs';

const ip = (req) =>
  req.headers?.['x-forwarded-for'] ||
  req.connection?.remoteAddress ||
  req.socket?.remoteAddress ||
  req.connection?.socket?.remoteAddress;

const end = (req, res, status, message) => {
  const body = message instanceof Error ? message.message : String(message);
  res.statusCode = status;
  res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'));
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
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
    this._defaultNotFound = (req, res) => end(req, res, 404, `${req.method} ${req.pathname} is undefined.`);
    this._fallbackStack = null;
  }

  start(callback = function cb() {}) {
    const work = () => {
      this.prepare();
      this.server = this.server || http.createServer();
      this.server.on('request', this.dispatch);
      this.server.once('listening', () => {
        const address = this.server.address();
        address.workerPid = process.pid;
        callback(address);
      });
      this.server.listen(this.port, this.host);
    };

    if (this.stormOptions) {
      storm(work, this.stormOptions);
    } else {
      work();
    }

    return this.server;
  }

  dispatch(req, res) {
    parseRequest(req);
    req.ip = ip(req);

    let stack;
    const route = this.fetch(req.method, req.pathname);
    if (!route) {
      req.params = {};
      const handler = this.notFound || this._defaultNotFound;
      if (this._fallbackGates !== this.gates || this._fallbackHandler !== handler) {
        this._fallbackGates = this.gates;
        this._fallbackHandler = handler;
        this._fallbackStack = this.gates.concat(handler);
      }
      stack = this._fallbackStack;
    } else {
      req.params = route.params;
      stack = route.dispatchStack;
    }

    return this.step(req, res, stack);
  }

  step(req, res, stack, index = 0, error = null, statusCode = 400) {
    const fn = stack[index];

    if (error) {
      return this.onError ? this.onError(error, req, res, fn) : end(req, res, statusCode, error);
    }

    if (fn) {
      return fn(req, res, (err) => {
        if (err) return this.step(req, res, stack, index, err, statusCode);
        return this.step(req, res, stack, index + 1);
      });
    }

    throw new Error('No handler to move to, the stack is empty.');
  }
}

export default function rayo(options = {}) {
  return new Rayo(options);
}
