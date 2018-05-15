const { METHODS } = require('http');
const { exec, match, parse } = require('matchit');

class Handler {
  constructor(method) {
    this.run = (...args) => method.apply(this, args);
  }
}

module.exports = class Router {
  constructor() {
    this.routes = [];
    this.middleware = {};
    METHODS.forEach((method) => {
      this[method.toLowerCase()] = this.route.bind(this, method);
    });
  }

  route(method, url, ...functions) {
    this.routes[method] = this.routes[method] || [];
    this.middleware[method] = this.middleware[method] || {};
    this.routes[method].push(parse(url));
    this.middleware[method][url] = functions.map((fn) => new Handler(fn));

    return this;
  }

  fetch(method, path) {
    const url = match(path, this.routes[method] || []);
    const through =
      this.middleware['*'] && this.middleware['*']['*'] ? this.middleware['*']['*'] : [];
    return !url.length
      ? null
      : {
          params: exec(path, url),
          middleware: through.concat(this.middleware[method][url[0].old])
        };
  }
};
