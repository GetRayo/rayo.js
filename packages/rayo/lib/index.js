const http = require('http');
const parseurl = require('parseurl');
const { parse } = require('querystring');
const Bridge = require('./bridge');
const { send } = require('./response');

class Index extends Bridge {
  constructor(options) {
    super();
    ({
      port: this.port,
      host: this.host,
      onError: this.onError = null,
      notFound: this.notFound = null,
      server: this.server = http.createServer()
    } = options);
    this.dispatch = this.dispatch.bind(this);
  }

  start(callback = function cb() {}) {
    this.server.listen(this.port, this.host);
    this.server.on('request', this.dispatch);
    this.server.on('listening', () => {
      this.through();
      callback(this.server.address());
    });

    return this.server;
  }

  dispatch(req, res) {
    res.send = send.bind(res);
    const parsedUrl = parseurl(req);
    const route = this.fetch(req.method, parsedUrl.pathname);
    if (!route) {
      return this.notFound
        ? this.notFound(req, res)
        : res.send(`${req.method} ${parsedUrl.pathname} is undefined.`, 404);
    }

    req.params = route.params;
    req.pathname = parsedUrl.pathname;
    req.query = this.cache.queries[parsedUrl.query] || parse(parsedUrl.query);
    this.cache.queries[parsedUrl.query] = req.query;
    return this.step(req, res, route.stack.slice());
  }

  step(req, res, stack, error = null, statusCode = null) {
    const fn = stack.shift();
    if (error) {
      return this.onError
        ? this.onError(error, req, res, fn)
        : res.send(error, statusCode || 400);
    }

    if (fn) {
      return fn(req, res, this.step.bind(this, req, res, stack));
    }

    throw new Error('No handler to move to, the stack is empty.');
  }
}

module.exports = (options = {}) => new Index(options);
