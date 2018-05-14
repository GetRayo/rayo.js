const http = require('http');
const parseurl = require('parseurl');
const { exec, match } = require('matchit');
const { parse: parseQuery } = require('querystring');
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
    this.runner = this.runner.bind(this);
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

  start(callback = function cb() {}) {
    this.server.on('request', this.runner);
    this.server.listen(this.port, this.hostname, callback);
    return this.server;
  }

  runner(req, res) {
    res.send = send.bind(res);
    const parsedUrl = parseurl(req);
    const routes = this.rt[req.method] || [];

    if (!routes.length) {
      return res.send('No routes for this method were found.', 400);
    }

    const urlMatch = match(parsedUrl.pathname, routes);
    if (!urlMatch.length) {
      return res.send('Page not found.', 404);
    }

    req.params = exec(parsedUrl.pathname, urlMatch);
    req.query = parseQuery(parsedUrl.query);
    const through = this.mw['*'] && this.mw['*']['*'] ? this.mw['*']['*'] : [];
    const middleware = through.concat(this.mw[req.method][urlMatch[0].old]);
    return this.stack.bind(this, req, res, middleware.slice())();
  }
}

module.exports = (options = {}) => new Rayo(options);
