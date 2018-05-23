const { METHODS } = require('http');
const { exec, match, parse } = require('matchit');

const bridges = [];
const bridgeThrough = (t) => {
  bridges.forEach((b, i) => {
    Object.keys(b.routes).forEach((m) => {
      t.routes[m] = b.routes[m].concat(t.routes[m] || []);
    });

    Object.keys(b.mw).forEach((m) => {
      t.mw[m] = t.mw[m] || {};
      Object.keys(b.mw[m]).forEach((p) => {
        t.mw[m][p] = b.mw[m][p].concat(t.mw[m][p] || []);
      });
    });

    bridges.splice(i, 1);
  });
};

module.exports = class Router {
  constructor(path = null) {
    this.routes = {};
    this.mw = {};
    this.tw = [];
    this.cache = { urls: {}, queries: {} };
    this.bridge = (pathToBridge) => {
      const bridge = new Router(pathToBridge);
      bridges.push(bridge);
      return bridge;
    };
    METHODS.push('all');
    METHODS.forEach((method) => {
      const bind = [method];
      if (path) {
        bind.push(path);
      }
      this[method.toLowerCase()] = this.route.bind(this, ...bind);
    });
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
    const set = (m) => {
      this.routes[m] = this.routes[m] || [];
      this.mw[m] = this.mw[m] || {};
      this.routes[m].push(parse(path));
      this.mw[m][path] = functions.map((fn) => (...args) => fn(...args));
    };

    if (method === 'all') {
      METHODS.forEach((m) => set(m));
    } else {
      set(method);
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
