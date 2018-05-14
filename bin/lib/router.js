const { METHODS } = require('http');
const { parse } = require('matchit');

class Handler {
  constructor(method) {
    this.run = (...args) => method.apply(this, args);
  }
}

module.exports = class Router {
  constructor() {
    this.rt = [];
    this.mw = {};
    METHODS.forEach((method) => {
      this[method.toLowerCase()] = this.route.bind(this, method);
    });
  }

  /**
   * @param method      HTTP method/verb
   * @param url         URI/path being mapped as a route
   * @param functions   Middleware functions
   * @returns {module.Router}
   */
  route(method, url, ...functions) {
    this.rt[method] = this.rt[method] || [];
    this.mw[method] = this.mw[method] || {};
    this.rt[method].push(parse(url));
    this.mw[method][url] = functions.map((fn) => new Handler(fn));

    return this;
  }
};
