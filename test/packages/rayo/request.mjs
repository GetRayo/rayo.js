import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { parse as parseQuery } from 'node:querystring';
import parseurl from 'parseurl';
import rayo from '../../../packages/rayo/index.js';
import parseRequest from '../../../packages/rayo/request.mjs';
import pathnameOf from '../../../packages/storm/pathname.mjs';

const previous = (req) => {
  const parsed = parseurl(req);
  return { pathname: parsed.pathname, query: parsed.query ? parseQuery(parsed.query) : {} };
};
const current = (req) => {
  parseRequest(req);
  return { pathname: req.pathname, query: req.query };
};
const compare = (url) => {
  let expected;
  try {
    expected = previous({ url });
  } catch (error) {
    assert.throws(() => current({ url }), error.constructor, JSON.stringify(url));
    assert.throws(() => pathnameOf(url), error.constructor, JSON.stringify(url));
    return;
  }
  assert.deepEqual(current({ url }), expected, JSON.stringify(url));
  assert.equal(pathnameOf(url), expected.pathname, JSON.stringify(url));
};

export default function requestTests() {
  it('keeps encoded separators, dot segments and backslashes raw while decoding only query values', () => {
    const req = { url: '/a/../b//c%2Fd\\e?tag=x&tag=y&name=Space+Cat&empty=&flag&bad=%E0%A4%A&value=a?b=c' };
    parseRequest(req);
    assert.equal(req.pathname, '/a/../b//c%2Fd\\e');
    assert.deepEqual(
      { ...req.query },
      {
        tag: ['x', 'y'],
        name: 'Space Cat',
        empty: '',
        flag: '',
        bad: '\ufffd%A',
        value: 'a?b=c'
      }
    );
    assert.equal(Object.getPrototypeOf(req.query), null);
  });

  it('preserves empty query behavior and uses a separate result object for every request', () => {
    for (const url of ['/', '/?', '/x?', '/x?#fragment', '/x']) {
      const first = { url },
        second = { url };
      parseRequest(first);
      parseRequest(second);
      assert.deepEqual(first.query, {});
      assert.equal(Object.getPrototypeOf(first.query), Object.prototype);
      first.query.changed = true;
      assert.deepEqual(second.query, {});
    }
  });

  it('preserves query key limits, repeated keys and prototype-like key names', () => {
    const url = '/query?__proto__=value&constructor=x&tag=a&tag=b';
    const req = { url };
    parseRequest(req);
    assert.equal(req.query.__proto__, 'value');
    assert.equal(req.query.constructor, 'x');
    assert.deepEqual(req.query.tag, ['a', 'b']);
    const many = { url: `/query?${Array.from({ length: 1200 }, (_, i) => `k${i}=${i}`).join('&')}` };
    parseRequest(many);
    assert.equal(Object.keys(many.query).length, 1000);
    assert.equal(many.query.k999, '999');
    assert.equal(many.query.k1000, undefined);
  });

  it('agrees with parseurl on supported request forms and legacy fallback cases', () => {
    for (const url of [
      '',
      '/',
      '//',
      '///',
      '////',
      '*',
      '*?x=y',
      '?x=y',
      'relative/path?x=y',
      '/x?first=1?second=2',
      '/x#fragment?ignored=yes',
      '/x?yes=1#fragment',
      '/x%23y?value=%3F%23%2F',
      '/x\\y',
      '/x\\y?x=1',
      '/x\v?x=1',
      '/caf\u00e9/\ud83d\ude80?q=%F0%9F%9A%80',
      '/%ZZ?bad=%ZZ',
      '/%00?zero=%00',
      'http://example.test/a/../b?x=1#fragment',
      'https://user:pw@example.test:8080/a?x=1',
      '//example.test/path?x=1',
      'http://[::1]:8080/path?x=1',
      'http://[invalid',
      'http://example.test',
      'example.test:443',
      'mailto:user@example.test?subject=Hi',
      '/x\t?x=y',
      '/x\n?x=y',
      '/x\r?x=y',
      '/x\f?x=y',
      '/x y?x=y',
      '/x\u00a0?x=y',
      '/x\ufeff?x=y',
      '\t/path?x=y\r\n'
    ])
      compare(url);
  });

  it('matches a deterministic varied URL corpus without changing either input', () => {
    let seed = 0x51a7;
    const pick = (length) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % length;
    };
    const beginnings = ['/', '//', '/api/', 'http://example.test/', 'relative/', '*', 'https://[::1]/'];
    const pieces = [
      'a',
      'b',
      '/',
      '//',
      ':',
      '.',
      '..',
      '\\',
      '?',
      '&',
      '=',
      '#',
      '%2F',
      '%3F',
      '%ZZ',
      '+',
      '\t',
      '\n',
      '\r',
      '\f',
      '\v',
      ' ',
      '\u00a0',
      '\ufeff',
      '\u00e9',
      '\ud83d\ude80',
      '\0'
    ];
    for (let i = 0; i < 6000; i += 1) {
      let url = beginnings[pick(beginnings.length)];
      const count = pick(20);
      for (let j = 0; j < count; j += 1) url += pieces[pick(pieces.length)];
      compare(url);
    }
  });

  it('classifies every UTF-16 code unit consistently in path and query positions', () => {
    // A broader whitespace regex would change legacy handling of some control
    // characters. Exhaustively cover the fast-path boundary, including surrogates.
    for (let code = 0; code <= 0xffff; code += 1) {
      const character = String.fromCharCode(code);
      compare(`/a${character}b?x=y`);
      compare(`/a?x=${character}&end=z`);
    }
  });

  it('rereads changed URLs on redispatch and leaves middleware caches untouched', () => {
    const req = { url: '/before?x=1' };
    const cache = parseurl(req);
    parseRequest(req);
    req.url = '/after?x=2&x=3';
    parseRequest(req);
    assert.equal(req.pathname, '/after');
    assert.deepEqual({ ...req.query }, { x: ['2', '3'] });
    assert.equal(req._parsedUrl, cache);
    assert.equal(parseurl(req).pathname, '/after');
  });

  it('rebuilds query values on same-target redispatch without sharing middleware mutations', () => {
    const req = { url: '/same?tag=a&tag=b&value=original' };
    const cache = parseurl(req);
    parseRequest(req);
    const first = req.query;
    first.tag.push('changed');
    first.value = 'changed';
    req.pathname = '/changed';
    parseRequest(req);
    assert.equal(req.pathname, '/same');
    assert.notEqual(req.query, first);
    assert.deepEqual({ ...req.query }, { tag: ['a', 'b'], value: 'original' });
    assert.equal(req._parsedUrl, cache);
  });

  it('routes real HTTP requests without normalizing paths and supports explicit redispatch', async () => {
    const echo = (req, res) =>
      res.end(JSON.stringify({ pathname: req.pathname, query: req.query, params: req.params }));
    const app = rayo({ host: '127.0.0.1', port: 0, notFound: echo });
    app.get('/files/:name', echo).get('/a/../b', echo).get('/after', echo).options('*', echo);
    app.get('/before', (req, res) => {
      req.url = '/after?new=1';
      app.dispatch(req, res);
    });
    const server = app.start();
    await once(server, 'listening');
    try {
      for (const [method, path, pathname, query, params] of [
        ['GET', '/files/a%2Fb?tag=x&tag=y', '/files/a%2Fb', { tag: ['x', 'y'] }, { name: 'a%2Fb' }],
        ['GET', '/a/../b?x=1', '/a/../b', { x: '1' }, {}],
        ['GET', 'http://example.test/files/absolute?q=ok', '/files/absolute', { q: 'ok' }, { name: 'absolute' }],
        ['GET', '/before?old=1', '/after', { new: '1' }, {}],
        ['GET', '/missing?value=%3F%23', '/missing', { value: '?#' }, {}],
        ['OPTIONS', '*', '*', {}, { '*': '*' }]
      ]) {
        const received = await new Promise((resolve, reject) => {
          const outgoing = request({ host: '127.0.0.1', port: server.address().port, method, path }, (res) => {
            let body = '';
            res.setEncoding('utf8').on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => resolve(JSON.parse(body))).on('error', reject);
          });
          outgoing.on('error', reject).end();
        });
        assert.deepEqual(received, { pathname, query, params }, path);
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
