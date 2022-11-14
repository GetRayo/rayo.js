import { METHODS } from 'http';
import { exec, match, parse } from 'matchit';

const bridgeThrough = (t) => {
  t.bridges.forEach((b) => {
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

export default class Bridge {
  /**
   * this.s = A placeholder for `stacks`. One stack per HTTP verb.
   * this.t = A placeholder for `through` routes.
   */
  constructor(path = null) {
    this.id = process.hrtime().join('');
    this.routes = [];
    this.s = [];
    this.bridges = [];
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
      this.bridge = (bridgedPath) => {
        const bridge = new Bridge(bridgedPath);
        this.bridges.push(bridge);
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
    const url = match(path, this.routes[verb] || []);
    return !url.length
      ? null
      : {
          params: exec(path, url),
          stack: this.s[verb][url[0].old]
        };
  }
}
