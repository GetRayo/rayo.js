import parseRoute from './route-parser.mjs';
import Router from './router.mjs';

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];

export default class Bridge {
  constructor(path = null, parent = null) {
    this.id = process.hrtime().join('');
    this.routes = {};
    this.stacks = {};
    this.bridges = new Set();
    this.bridgedPath = path;
    this.gates = [];
    this._parent = parent;
    this._registrations = new Map();
    this._middleware = [];
    this._records = new Map();
    this._indexes = new Map();
    this._dirty = true;
    [...METHODS, 'all'].forEach((verb) => {
      this[verb.toLowerCase()] = this.route.bind(this, verb, ...(path ? [path] : []));
    });

    if (!path) {
      this.bridge = (bridgedPath) => {
        const bridge = new Bridge(bridgedPath, this);
        this.bridges.add(bridge);
        this.invalidate();
        return bridge;
      };
    }
  }

  invalidate() {
    this._dirty = true;
    if (this._parent) this._parent.invalidate();
  }

  through(...handlers) {
    if (!handlers.length) return this.prepare();
    this._middleware = this._middleware.concat(handlers);
    this.invalidate();
    return this;
  }

  route(verb, path, ...handlers) {
    for (const method of verb === 'all' ? METHODS : [verb]) {
      if (!this._registrations.has(method)) this._registrations.set(method, new Map());
      const routes = this._registrations.get(method);
      const existing = routes.get(path);
      routes.set(path, {
        segments: existing ? existing.segments : parseRoute(path),
        stack: existing ? existing.stack.concat(handlers) : handlers
      });
    }
    this.invalidate();
    return this;
  }

  prepare() {
    if (!this._dirty) return this;
    const records = new Map();
    const append = (method, path, segments, stack) => {
      if (!records.has(method)) records.set(method, new Map());
      const routes = records.get(method);
      const existing = routes.get(path);
      if (existing) existing.stack = existing.stack.concat(stack);
      else routes.set(path, { segments, stack });
    };

    // Bridges precede direct routes; later bridges are checked first.
    for (const bridge of [...this.bridges].reverse()) {
      bridge.prepare();
      for (const [method, routes] of bridge._records) {
        for (const [path, route] of routes) append(method, path, route.segments, route.dispatchStack);
      }
    }
    for (const [method, routes] of this._registrations) {
      for (const [path, route] of routes) append(method, path, route.segments, route.stack);
    }

    this.gates = this._middleware;
    this.routes = {};
    this.stacks = {};
    this._indexes = new Map();
    for (const [method, routes] of records) {
      this.routes[method] = [];
      this.stacks[method] = Object.create(null);
      for (const [path, route] of routes) {
        route.dispatchStack = this.gates.length ? this.gates.concat(route.stack) : route.stack;
        this.routes[method].push(route.segments);
        this.stacks[method][path] = route.stack;
      }
      this._indexes.set(method, new Router([...routes.values()]));
    }
    this._records = records;
    this._dirty = false;
    return this;
  }

  fetch(verb, path) {
    if (this._dirty) this.prepare();
    return this._indexes.get(verb)?.find(path) || null;
  }
}
