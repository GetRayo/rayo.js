const { parse } = require('matchit');

class Handler {
  constructor(method) {
    this.run = (...args) => method.apply(this, args);
  }
}

module.exports = class Router {
  constructor() {
    this.routes = [];
    this.middleware = {};
  }

  /**
   * The "stack" (this.routes) essentially provides middleware functionality.
   * By passing back a stack-move-forward function, such as next(),
   * multiple middleware can be applied to the same route/path.
   *
   * @param method      HTTP method/verb
   * @param url         URI/path being mapped as a route
   * @param functions   Middleware functions
   * @returns {module.Router}
   */
  route(method, url, ...functions) {
    if (!this.routes[method]) {
      this.routes[method] = [];
    }

    if (!this.middleware[method]) {
      this.middleware[method] = {};
    }

    this.routes[method].push(parse(url));
    this.middleware[method][url] = functions.map((fn) => new Handler(fn));
    return this;
  }
};
