const { METHODS } = require('http');
const { exec, match, parse } = require('matchit');

let bridges = [];
const bridgeThrough = (t) => {
  if (!bridges.length) {
    return;
  }

  bridges.forEach((b) => {
    Object.keys(b.routes).forEach((m) => {
      t.routes[m] = b.routes[m].concat(t.routes[m] || []);
    });

    Object.keys(b.mw).forEach((m) => {
      t.mw[m] = t.mw[m] || {};
      Object.keys(b.mw[m]).forEach((p) => {
        t.mw[m][p] = b.mw[m][p].concat(t.mw[m][p] || []);
      });
    });
  });

  bridges = [];
};

module.exports = class Router {
  constructor(path = null) {
    this.routes = {};
    this.mw = {};
    this.tw = [];
    this.cache = { urls: {}, queries: {} };
    METHODS.forEach((method) => {
      const bind = [method];
      if (path) {
        bind.push(path);
      }
      this[method.toLowerCase()] = this.route.bind(this, ...bind);
    });

    this.bridge = (pathToBridge) => {
      const bridge = new Router(pathToBridge);
      bridges.push(bridge);
      return bridge;
    };
  }

  through(...functions) {
    if (!functions.length) {
      this.tw = this.mw['*'] && this.mw['*']['*'] ? this.mw['*']['*'] : [];
      bridgeThrough(this);
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
