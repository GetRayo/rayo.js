const { METHODS } = require('http');
const { exec, match, parse } = require('matchit');

const bridges = [];
const bridgeThrough = (t) => {
  bridges.forEach((b) => {
    Object.keys(b.routes).forEach((v) => {
      t.routes[v] = b.routes[v].concat(t.routes[v] || []);
    });

    Object.keys(b.s).forEach((v) => {
      t.s[v] = t.s[v] || {};
      Object.keys(b.s[v]).forEach((p) => {
        t.s[v][p] = b.s[v][p].concat(t.s[v][p] || []);
      });
    });
  });

  return t;
};

module.exports = class Bridge {
  constructor(path = null) {
    this.id = process.hrtime().join('');
    this.routes = {};
    this.s = {};
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
      this.t = this.s['*'] && this.s['*']['*'] ? this.s['*']['*'] : [];
      return bridgeThrough(this);
    }

    const [verb, path] = this.bridgedPath ? ['all', this.bridgedPath] : ['*', '*'];
    return this.route(verb, path, ...handlers);
  }

  route(verb, path, ...handlers) {
    const set = (m) => {
      this.routes[m] = this.routes[m] || [];
      this.s[m] = this.s[m] || {};
      this.routes[m].push(parse(path));
      this.s[m][path] = (this.s[m][path] || []).concat(handlers);
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
    const url = this.cache.urls[verb][path] || match(path, this.routes[verb] || []);
    this.cache.urls[verb][path] = url;
    return !url.length
      ? null
      : {
          params: exec(path, url),
          stack: this.t.concat(this.s[verb][url[0].old])
        };
  }
};
