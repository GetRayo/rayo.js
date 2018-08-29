const http = require('http');
const parseurl = require('parseurl');
const { parse } = require('querystring');
const { storm } = require('@rayo/storm');
const Bridge = require('./bridge');

const end = (req, res, status, error) => {
  res.statusCode = status;
  res.setHeader('Content-Length', error.length);
  res.setHeader('Content-Type', 'text/plain');
  res.end(error);
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
    const work = (workerPid = undefined) => {
      this.server = this.server || http.createServer();
      this.server.listen(this.port, this.host);
      this.server.on('request', this.dispatch);
      this.server.once('listening', () => {
        this.through();
        const address = this.server.address();
        address.workerPid = workerPid;
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
    const route = this.fetch(req.method, parsedUrl.pathname);
    if (!route) {
      return this.notFound
        ? this.notFound(req, res)
        : end(req, res, 404, `${req.method} ${parsedUrl.pathname} is undefined.`);
    }

    req.params = route.params;
    req.pathname = parsedUrl.pathname;
    req.query = parse(parsedUrl.query);
    return this.step(req, res, route.stack);
  }

  step(req, res, stack, error = null, statusCode = 400) {
    const fn = stack.shift();
    if (error) {
      return this.onError
        ? this.onError(error, req, res, fn)
        : end(req, res, statusCode, error);
    }

    if (fn) {
      return fn(req, res, this.step.bind(this, req, res, stack));
    }

    throw new Error('No handler to move to, the stack is empty.');
  }
}

module.exports = (options = {}) => new Rayo(options);
