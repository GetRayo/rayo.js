const http = require('http');
const parseurl = require('parseurl');
const { parse } = require('querystring');
const Router = require('./lib/router');
const { send } = require('./lib/response');

const stack = (req, res, middleware, error = null, statusCode = null) => {
  const step = middleware.shift();
  if (!step) {
    throw new Error('Your stack is empty.');
  }

  if (error) {
    return res.send(error, statusCode || 400);
  }

  return step(req, res, stack.bind(null, req, res, middleware));
};

class Rayo extends Router {
  constructor(options) {
    super();
    ({
      port: this.port,
      hostname: this.hostname,
      server: this.server = http.createServer()
    } = options);
    this.dispatch = this.dispatch.bind(this);
    this.queries = {};
  }

  dispatch(req, res) {
    res.send = send.bind(res);
    const parsedUrl = parseurl(req);
    const route = this.fetch(req.method, parsedUrl.pathname);

    if (!route) {
      return res.send('Page not found.', 404);
    }

    req.params = route.params;
    req.query = this.queries[parsedUrl.query] || parse(parsedUrl.query);
    this.queries[parsedUrl.query] = req.query;
    return stack(req, res, route.middleware.slice());
  }

  start(callback = function cb() {}) {
    this.server.on('request', this.dispatch);
    this.server.listen(this.port, this.hostname, callback);
    this.through();
    return this.server;
  }
}

module.exports = (options = {}) => new Rayo(options);
