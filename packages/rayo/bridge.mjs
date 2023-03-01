import { exec, match, parse } from 'matchit';

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH', 'all'];
const bridgeThrough = (t) => {
  t.bridges.forEach((b) => {
    for (const [k, v] of Object.entries(b.routes)) {
      t.routes[k] = v.concat(t.routes[k]);
    }

    for (const [k, v] of Object.entries(b.stacks)) {
      t.stacks[k] = t.stacks[k] || {};
      for (const [kk, vv] of Object.entries(v)) {
        t.stacks[k][kk] = v[kk].concat(vv);
      }
    }
  });

  return t;
};

export default class Bridge {
  constructor(path = null) {
    this.id = process.hrtime().join('');
    this.routes = {};
    this.stacks = {};
    this.bridges = new Set();
    this.bridgedPath = path;
    METHODS.forEach((verb) => {
      const bind = [verb];
      if (path) {
        bind.push(path);
      }
      this[verb.toLowerCase()] = this.route.bind(this, ...bind);
    });

    if (!path) {
      this.gates = [];
      this.bridge = (bridgedPath) => {
        const bridge = new Bridge(bridgedPath);
        this.bridges.add(bridge);
        return bridge;
      };
    }
  }

  through(...handlers) {
    if (!handlers.length) {
      this.gates = this.stacks['*']?.['*'] || [];
      return bridgeThrough(this);
    }

    const [verb, path] = this.bridgedPath ? ['through', this.bridgedPath] : ['*', '*'];
    return this.route(verb, path, ...handlers);
  }

  route(verb, path, ...handlers) {
    const set = (m) => {
      this.routes[m] = this.routes[m] || [];
      this.stacks[m] = this.stacks[m] || {};
      this.routes[m].push(parse(path));
      this.stacks[m][path] = (this.stacks[m][path] || []).concat(handlers);
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
          stack: this.stacks[verb][url[0].old]
        };
  }
}
