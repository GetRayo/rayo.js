const { METHODS } = require('http');
const { exec, match, parse } = require('matchit');

module.exports = class Router {
  constructor() {
    this.routes = {};
    this.mw = {};
    this.tw = [];
    METHODS.forEach((method) => {
      this[method.toLowerCase()] = this.route.bind(this, method);
    });
  }

  through(...functions) {
    if (!functions.length) {
      this.tw = this.mw['*'] && this.mw['*']['*'] ? this.mw['*']['*'] : [];
    } else {
      this.route('*', '*', ...functions);
    }

    return this;
  }

  route(method, path, ...functions) {
    this.routes[method] = this.routes[method] || [];
    this.mw[method] = this.mw[method] || {};
    this.routes[method].push(parse(path));
    this.mw[method][path] = functions.map((fn) => (...args) => fn(...args));

    return this;
  }

  fetch(method, path) {
    const url = match(path, this.routes[method] || []);
    return !url.length
      ? null
      : {
          params: exec(path, url),
          middleware: this.tw.concat(this.mw[method][url[0].old])
        };
  }
};
