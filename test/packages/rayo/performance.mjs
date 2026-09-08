import assert from 'node:assert/strict';
import { parse, match, exec } from 'matchit';
import rayo from '../../../packages/rayo/index.js';
import Bridge from '../../../packages/rayo/bridge.mjs';

const request = (url = '/') => ({ method: 'GET', url, headers: {}, socket: {} });
const response = () => ({
  headers: {},
  setHeader(key, value) {
    this.headers[key] = value;
  },
  end(value) {
    this.body = value;
  }
});

export default function performanceTest() {
  it('keeps matchit precedence and raw parameters across an overlapping route matrix', () => {
    const patterns = [
      '/',
      '/users/:id',
      '/users/me',
      '/users/:name',
      '/users/:id?',
      '/users/*',
      '/files/:name.json',
      '/files/:name',
      '/:resource/:id',
      '/:resource/:id?',
      '/files/*',
      '/*',
      '/:name?',
      '/:name',
      '/a/:first/:last?',
      '/a/:first?/x',
      '/a//b',
      '/trailing/',
      '/x/:x.:ext'
    ];
    const paths = [
      '/',
      '',
      '//',
      '///',
      '/users',
      '/users/',
      '/users/me',
      '/users/a%20b',
      '/users/%ZZ',
      '/users/a/b',
      '/files/x.json',
      '/files/x.json.json',
      '/files/a.txt',
      '/a',
      '/a/',
      '/a/b',
      '/a/b/c',
      '/a//b',
      '/a//x',
      '/trailing',
      '/trailing/',
      '/missing/a/b',
      '/x/thing.txt'
    ];
    // Rotate and reverse registrations so every pattern takes different
    // precedence against static, parameter, optional and wildcard alternatives.
    for (let offset = 0; offset < patterns.length; offset += 1) {
      const rotated = patterns.slice(offset).concat(patterns.slice(0, offset));
      for (const order of [rotated, [...rotated].reverse()]) {
        const bridge = new Bridge();
        const parsed = order.map(parse);
        const handlers = order.map((pattern) => () => pattern);
        order.forEach((pattern, index) => bridge.get(pattern, handlers[index]));
        for (const path of paths) {
          const expected = match(path, parsed);
          const actual = bridge.fetch('GET', path);
          if (!expected.length) assert.equal(actual, null, `${order[0]} / ${path}`);
          else {
            assert.deepEqual(actual.params, exec(path, expected), path);
            assert.equal(actual.stack[0](), expected[0].old, path);
          }
        }
      }
    }
  });

  it('isolates methods, handles late routes and misses, and combines duplicate registrations', () => {
    const bridge = new Bridge();
    const first = () => 1,
      second = () => 2;
    for (let i = 0; i < 1000; i += 1) bridge.get(`/resource${i}/:id`, first);
    bridge.get('/resource999/:id', second).post('/resource999/:id', second);
    assert.deepEqual(bridge.fetch('GET', '/resource999/42').stack, [first, second]);
    assert.deepEqual(bridge.fetch('GET', '/resource999/42').params, { id: '42' });
    assert.deepEqual(bridge.fetch('POST', '/resource999/42').stack, [second]);
    assert.equal(bridge.fetch('PATCH', '/resource999/42'), null);
    assert.equal(bridge.fetch('GET', '/absent/42'), null);
  });

  it('runs bridged middleware once and prepares idempotently', () => {
    const calls = [];
    const trace = (name) => (req, res, next) => {
      calls.push(name);
      next();
    };
    const app = rayo().through(trace('global'));
    app.get('/other', (req, res) => res.end('other'));
    app
      .bridge('/account')
      .through(trace('auth'))
      .get(trace('route'), (req, res) => res.end('account'));
    app.prepare().prepare().through();
    const stack = app.fetch('GET', '/account').dispatchStack;
    const res = response();
    app.dispatch(request('/account'), res);
    assert.deepEqual(calls, ['global', 'auth', 'route']);
    assert.equal(res.body, 'account');
    assert.equal(app.fetch('GET', '/account').dispatchStack, stack);
    assert.equal(app.routes.GET.length, 2);
    calls.length = 0;
    app.dispatch(request('/other'), response());
    assert.deepEqual(calls, ['global']);
  });

  it('invalidates prepared routes and middleware through nested bridges', () => {
    const app = rayo();
    const group = app.bridge();
    const bridge = group.bridge('/item');
    bridge.get((req, res) => res.end(req.tag || 'before'));
    app.prepare();
    const before = app.fetch('GET', '/item').dispatchStack;
    group.through((req, res, next) => {
      req.tag = 'after';
      next();
    });
    const res = response();
    app.dispatch(request('/item'), res);
    assert.equal(res.body, 'after');
    assert.notEqual(app.fetch('GET', '/item').dispatchStack, before);
    bridge.post((req, res) => res.end('post'));
    assert.ok(app.fetch('POST', '/item'));
  });

  it('keeps bridge precedence and combines handlers for the same literal route', () => {
    const app = rayo();
    const calls = [];
    app.get('/item', (req, res) => {
      calls.push('direct');
      res.end('done');
    });
    app.bridge('/item').get((req, res, next) => {
      calls.push('first bridge');
      next();
    });
    app.bridge('/item').get((req, res, next) => {
      calls.push('last bridge');
      next();
    });
    app.dispatch(request('/item'), response());
    assert.deepEqual(calls, ['last bridge', 'first bridge', 'direct']);
    assert.equal(app.routes.GET.length, 1);
  });

  it('keeps asynchronous middleware state private to each request', async () => {
    const app = rayo().through((req, res, next) => {
      req.events = ['first'];
      next();
    });
    app.get(
      '/:id',
      (req, res, next) => {
        setTimeout(
          () => {
            req.events.push(req.params.id);
            next();
          },
          req.params.id === 'a' ? 10 : 0
        );
      },
      (req, res) => {
        req.events.push('last');
        res.end(req.events.join(','));
      }
    );
    const run = (id) => new Promise((resolve) => app.dispatch(request(`/${id}`), { end: resolve }));
    assert.deepEqual(await Promise.all([run('a'), run('b')]), ['first,a,last', 'first,b,last']);
  });

  it('retains continuation behavior when called twice and routes errors without corrupting shared stacks', () => {
    let calls = 0;
    const app = rayo({ onError: (error, req, res) => res.end(error.message) });
    app.get(
      '/repeat',
      (req, res, next) => {
        next();
        next();
      },
      () => {
        calls += 1;
      }
    );
    app.dispatch(request('/repeat'), response());
    assert.equal(calls, 2);
    app.get(
      '/error',
      (req, res, next) => next(new Error('failed')),
      () => {
        throw new Error('unreachable');
      }
    );
    for (let i = 0; i < 2; i += 1) {
      const res = response();
      app.dispatch(request('/error'), res);
      assert.equal(res.body, 'failed');
    }
  });

  it('keeps in-flight middleware snapshots stable when registration invalidates the cache', () => {
    let resume;
    const app = rayo().through((req, res, next) => {
      req.events = ['initial'];
      if (req.headers.pause) resume = next;
      else next();
    });
    app.get('/item', (req, res) => res.end(req.events.join(',')));
    const first = response();
    const paused = request('/item');
    paused.headers.pause = true;
    app.dispatch(paused, first);

    app.through((req, res, next) => {
      req.events.push('added');
      next();
    });
    const second = response();
    app.dispatch(request('/item'), second);
    resume();

    assert.equal(first.body, 'initial');
    assert.equal(second.body, 'initial,added');
  });

  it('runs current global middleware on misses and refreshes the fallback handler', () => {
    const app = rayo();
    const first = response();
    app.dispatch(request('/missing'), first);
    assert.equal(first.body, 'GET /missing is undefined.');
    app.through((req, res, next) => {
      req.message = 'custom';
      next();
    });
    app.notFound = (req, res) => res.end(req.message);
    const second = response();
    app.dispatch(request('/missing'), second);
    assert.equal(second.body, 'custom');
  });
}
