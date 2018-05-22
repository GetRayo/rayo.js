const { METHODS } = require('http');
const { exec, match, parse } = require('matchit');

module.exports = class Router {
  constructor() {
    this.routes = {};
    this.mw = {};
    this.tw = [];
    this.cache = { urls: {}, queries: {} };
    METHODS.forEach((method) => {
      this[method.toLowerCase()] = this.route.bind(this, method);
    });
  }

  bridge(path) {
    this.bridgedPath = path;
    return this;
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
    const setRoute = (m) => {
      this.routes[m] = this.routes[m] || [];
      this.mw[m] = this.mw[m] || {};
      this.routes[m].push(parse(path));
      this.mw[m][path] = functions.map((fn) => (...args) => fn(...args));
    };

    if (this.bridgedPath) {

    }

    if (Array.isArray(method)) {
      method.forEach(setRoute);
    } else {
      setRoute(method);
    }

    return this;
  }

  fetch(method, path) {
    this.cache.urls[method] = this.cache.urls[method] || {};
    const url = this.cache.urls[method][path] || match(path, this.routes[method] || []);
    this.cache.urls[method][path] = url;
    return !url.length
      ? null
      : {
          params: exec(path, url),
          middleware: this.tw.concat(this.mw[method][url[0].old])
        };
  }
};
