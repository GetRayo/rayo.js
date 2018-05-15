const http = require('http');
const parseurl = require('parseurl');
const { exec, match } = require('matchit');
const { parse } = require('querystring');
const Router = require('./lib/router');
const { send } = require('./lib/response');

class Rayo extends Router {
  constructor(options) {
    super();
    ({
      port: this.port,
      hostname: this.hostname,
      server: this.server = http.createServer()
    } = options);
    this.dispatch = this.dispatch.bind(this);
  }

  through(...functions) {
    this.route('*', '*', ...functions);
    return this;
  }

  stack(req, res, stack, error = null, statusCode = null) {
    const next = stack.shift();
    if (!next) {
      throw new Error('Your stack is empty.');
    }

    if (error) {
      return res.send(error, statusCode || 400);
    }

    return next.run(req, res, this.stack.bind(this, req, res, stack));
  }

  dispatch(req, res) {
    res.send = send.bind(res);
    const { pathname, query } = parseurl(req);
    const route = this.fetch(req.method, pathname);

    if (!route) {
      return res.send('Page not found.', 404);
    }

    req.params = route.params;
    req.query = parse(query);
    return this.stack.bind(this, req, res, route.middleware.slice())();
  }

  start(callback = function cb() {}) {
    this.server.on('request', this.dispatch);
    this.server.listen(this.port, this.hostname, callback);
    return this.server;
  }
}

module.exports = (options = {}) => new Rayo(options);
