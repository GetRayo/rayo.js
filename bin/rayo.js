const http = require('http');
const parseurl = require('parseurl');
const { exec, match } = require('matchit');
const { parse: parseQuery } = require('querystring');
const Router = require('./lib/router');
const { send } = require('./lib/response');

class Rayo extends Router {
  constructor() {
    super();
    this.runner = this.runner.bind(this);
    http.METHODS.forEach((method) => {
      this[method.toLowerCase()] = this.route.bind(this, method);
    });
  }

  stack(req, res, stack, error = null, statusCode = null) {
    const next = stack.shift();
    if (!next) {
      throw new Error('Nothing left in the stack.');
    }

    if (error) {
      return res.send(error, statusCode || 400);
    }

    return next.run(req, res, this.stack.bind(this, req, res, stack));
  }

  /**
   * Start Rayo on the specified port.
   * @param options
   * @param callback (optional)
   * @returns void
   */
  start(options = {}, callback = function cb() {}) {
    const { port, hostname, server = http.createServer() } = options;
    server.on('request', this.runner);
    server.listen(port, hostname, callback);
  }

  runner(req, res) {
    res.send = send.bind(res);
    const parsedUrl = parseurl(req);
    const routes = this.routes[req.method] || [];
    if (!routes.length) {
      return res.send('No routes for this method were found.', 400);
    }

    const urlMatch = match(parsedUrl.pathname, routes);
    if (!urlMatch.length) {
      return res.send('Page not found.', 404);
    }

    req.params = exec(parsedUrl.pathname, urlMatch);
    req.query = parseQuery(parsedUrl.query);
    const middleware = this.middleware[req.method][urlMatch[0].old];
    return this.stack.bind(this, req, res, middleware.slice())();
  }
}

module.exports = new Rayo();
