// Patterns are parsed once by matchit. The index preserves its registration
// precedence and matching rules, including raw (not decoded) parameters.
const node = () => ({ fixed: new Map(), dynamic: new Map(), route: null, order: Infinity });

const split = (path) => {
  if (path === '/') return ['/'];
  let value = path.charCodeAt(0) === 47 ? path.substring(1) : path;
  if (value.charCodeAt(value.length - 1) === 47) value = value.substring(0, value.length - 1);
  return value === '/' ? ['/'] : value.split('/');
};

export default class Router {
  constructor(routes) {
    this.root = node();
    routes.forEach((route, order) => {
      route.order = order;
      let current = this.root;
      current.order = Math.min(current.order, order);
      for (const segment of route.segments) {
        const fixed = segment.type === 0;
        const children = fixed ? current.fixed : current.dynamic;
        const key = fixed ? segment.val : `${segment.type}:${segment.end}`;
        if (!children.has(key)) children.set(key, { ...node(), segment });
        current = children.get(key);
        current.order = Math.min(current.order, order);
      }
      // Identical pattern shapes select the first registration, including its
      // parameter names. Duplicate literal paths are combined during prepare().
      if (!current.route) current.route = route;
    });
  }

  find(path) {
    const segments = split(path);
    let best = null;
    const visit = (current, depth) => {
      if (best && current.order >= best.order) return;
      const route = current.route;
      if (route && (!best || route.order < best.order)) {
        const last = route.segments[depth - 1];
        if (
          depth === segments.length ||
          (depth < segments.length && last?.type === 2) ||
          (depth > segments.length && last?.type === 3)
        ) {
          best = route;
        }
      }

      const value = segments[depth];
      const fixed = current.fixed.get(value);
      if (fixed) visit(fixed, depth + 1);
      for (const child of current.dynamic.values()) {
        if (value === '/' ? child.segment.type > 1 : (value || '').endsWith(child.segment.end)) {
          visit(child, depth + 1);
        }
      }
    };
    visit(this.root, 0);
    if (!best) return null;

    const params = {};
    for (let i = 0; i < best.segments.length; i += 1) {
      const value = segments[i];
      const segment = best.segments[i];
      if (value !== undefined && value !== '/' && segment.type !== 0) {
        const parameter = segment.end ? value.replace(segment.end, '') : value;
        if (segment.val === '__proto__') {
          Object.defineProperty(params, segment.val, {
            value: parameter,
            enumerable: true,
            writable: true,
            configurable: true
          });
        } else params[segment.val] = parameter;
      }
    }
    return { params, stack: best.stack, dispatchStack: best.dispatchStack };
  }
}
