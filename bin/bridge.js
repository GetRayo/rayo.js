const { METHODS } = require('http');
const { exec, match, parse } = require('matchit');

const bridges = [];
const bridgeThrough = (t) => {
  bridges.forEach((b) => {
    Object.keys(b.routes).forEach((v) => {
      t.routes[v] = b.routes[v].concat(t.routes[v] || []);
    });

    Object.keys(b.h).forEach((v) => {
      t.h[v] = t.h[v] || {};
      Object.keys(b.h[v]).forEach((p) => {
        t.h[v][p] = b.h[v][p].concat(t.h[v][p] || []);
      });
    });
  });
};

module.exports = class Bridge {
  constructor(path = null) {
    this.id = process.hrtime().join('');
    this.routes = {};
    this.h = {};
    this.bridgedPath = path;
    METHODS.push('all');
    METHODS.forEach((verb) => {
      const bind = [verb];
      if (path) {
        bind.push(path);
      }
      this[verb.toLowerCase()] = this.route.bind(this, ...bind);
    });

    if (!path) {
      this.t = [];
      this.cache = { urls: {}, queries: {} };
      this.bridge = (bridgedPath) => {
        const bridge = new Bridge(bridgedPath);
        bridges.push(bridge);
        return bridge;
      };
    }
  }

  through(...handlers) {
    if (!handlers.length) {
      this.t = this.h['*'] && this.h['*']['*'] ? this.h['*']['*'] : [];
      bridgeThrough(this);
    } else {
      const [verb, path] = this.bridgedPath
        ? ['all', this.bridgedPath]
        : ['*', '*'];
      this.route(verb, path, ...handlers);
    }

    return this;
  }

  route(verb, path, ...handlers) {
    const set = (m) => {
      this.routes[m] = this.routes[m] || [];
      this.h[m] = this.h[m] || {};
      this.routes[m].push(parse(path));
      this.h[m][path] = this.h[m][path] || [];
      this.h[m][path] = this.h[m][path]
        .concat(handlers)
        .map((fn) => (...args) => fn(...args));
    };

    if (verb === 'all') {
      METHODS.forEach((m) => (m !== 'all' ? set(m) : null));
    } else {
      set(verb);
    }

    return this;
  }

  fetch(verb, path) {
    this.cache.urls[verb] = this.cache.urls[verb] || {};
    const url =
      this.cache.urls[verb][path] || match(path, this.routes[verb] || []);
    this.cache.urls[verb][path] = url;
    return !url.length
      ? null
      : {
          params: exec(path, url),
          middleware: this.t.concat(this.h[verb][url[0].old])
        };
  }
};
