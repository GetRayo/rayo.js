const http = require('http');
const parseurl = require('parseurl');
const { parse } = require('querystring');
const Router = require('./lib/router');
const { send } = require('./lib/response');

const stack = (req, res, middleware, error = null, statusCode = null) => {
  const step = middleware.shift();
  if (!step) {
    throw new Error('No middleware to move to, there is nothing left in the stack.');
  }

  /**
   * @TODO
   * The send/return the error needs to be more flexible, user defined.
   */
  return error
    ? res.send(error, statusCode || 400)
    : step(req, res, stack.bind(null, req, res, middleware));
};

class Rayo extends Router {
  constructor(options) {
    super();
    ({ port: this.port, host: this.host, server: this.server = http.createServer() } = options);
    this.dispatch = this.dispatch.bind(this);
  }

  dispatch(req, res) {
    res.send = send.bind(res);
    const parsedUrl = parseurl(req);
    const route = this.fetch(req.method, parsedUrl.pathname);

    if (!route) {
      return res.send('Page not found.', 404);
    }

    req.params = route.params;
    req.query = this.cache.queries[parsedUrl.query] || parse(parsedUrl.query);
    this.cache.queries[parsedUrl.query] = req.query;
    return stack(req, res, route.middleware.slice());
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
}

module.exports = (options = {}) => new Rayo(options);
