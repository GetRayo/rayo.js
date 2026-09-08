import assert from 'node:assert/strict';
import { parse, match, exec } from 'matchit';
import parseRoute from '../../../packages/rayo/route-parser.mjs';
import Bridge from '../../../packages/rayo/bridge.mjs';

const random = (initial) => {
  let state = initial;
  return (limit) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % limit;
  };
};
const select = (values, next) => values[next(values.length)];

export default function routeParserTests() {
  it('compiles the supported route grammar into stable registration records', () => {
    const cases = [
      ['/', [[0, '/', '']]],
      ['', []],
      ['//', []],
      ['///', [[0, '', '']]],
      [
        'users/:id/',
        [
          [0, 'users', ''],
          [1, 'id', '']
        ]
      ],
      [
        '/users/:id?',
        [
          [0, 'users', ''],
          [3, 'id', '']
        ]
      ],
      [
        '/files/:name.json',
        [
          [0, 'files', ''],
          [1, 'name', '.json']
        ]
      ],
      [
        '/files/*',
        [
          [0, 'files', ''],
          [2, '*', '']
        ]
      ],
      [
        '/a//b',
        [
          [0, 'a', ''],
          [0, '', ''],
          [0, 'b', '']
        ]
      ],
      [
        '/a/b:c',
        [
          [0, 'a', ''],
          [0, 'b:c', '']
        ]
      ],
      [
        '/a/:',
        [
          [0, 'a', ''],
          [1, '', '']
        ]
      ],
      [
        '/a/:?',
        [
          [0, 'a', ''],
          [3, '', '']
        ]
      ],
      [
        '/a/::b',
        [
          [0, 'a', ''],
          [1, ':b', '']
        ]
      ],
      [
        '/café/:名字',
        [
          [0, 'café', ''],
          [1, '名字', '']
        ]
      ],
      [
        '/a/%2F',
        [
          [0, 'a', ''],
          [0, '%2F', '']
        ]
      ]
    ];
    for (const [pattern, expected] of cases) {
      assert.deepEqual(
        parseRoute(pattern),
        expected.map(([type, val, end]) => ({ old: pattern, type, val, end })),
        pattern
      );
    }
  });

  it('preserves existing parsing of unusual optional, suffix and wildcard patterns', () => {
    // These fixtures document compatibility quirks rather than recommended syntax.
    const cases = [
      [
        '/:id.json/edit',
        [
          [1, 'id', '.json/edit'],
          [0, 'edit', '']
        ]
      ],
      ['/:id?.json', [[3, 'id?', '.json']]],
      ['/:id.json?', [[3, 'id.json', '.json?']]],
      ['/:id.?', [[3, 'id.', '.?']]],
      ['/:id??', [[3, 'id?', '']]],
      ['/:id?.json?', [[3, 'id?.json', '.json?']]],
      [
        '/**',
        [
          [2, '**', ''],
          [2, '*', '']
        ]
      ],
      [
        '/*/edit',
        [
          [2, '*/edit', ''],
          [0, '', ''],
          [0, 'edit', '']
        ]
      ],
      [
        '/*named',
        [
          [2, '*named', ''],
          [0, 'named', '']
        ]
      ],
      ['/:name.:ext', [[1, 'name', '.:ext']]]
    ];
    for (const [pattern, expected] of cases) {
      assert.deepEqual(
        parseRoute(pattern),
        expected.map(([type, val, end]) => ({ old: pattern, type, val, end })),
        pattern
      );
    }
  });

  it('matches the pinned compiler on every short combination of grammar characters', () => {
    const alphabet = ['/', ':', '*', '?', '.', 'a'];
    const compare = (pattern, remaining) => {
      assert.deepEqual(parseRoute(pattern), parse(pattern), JSON.stringify(pattern));
      if (remaining) for (const character of alphabet) compare(pattern + character, remaining - 1);
    };
    compare('', 5); // 9,331 patterns, including malformed and repeated separators.
  });

  it('matches the pinned compiler on a reproducible corpus of longer and Unicode patterns', () => {
    const next = random(0x8ad71903);
    const alphabet = ['/', ':', '*', '?', '.', 'a', 'b', '%', '2', 'F', 'é', '雪', '\ud800', '\udfff'];
    for (let sample = 0; sample < 10000; sample += 1) {
      let pattern = '';
      const length = next(80);
      for (let index = 0; index < length; index += 1) pattern += select(alphabet, next);
      assert.deepEqual(parseRoute(pattern), parse(pattern), `sample ${sample}: ${JSON.stringify(pattern)}`);
    }
  });

  it('keeps generated route precedence and parameter extraction identical to the pinned matcher', () => {
    const next = random(0x617259e3);
    const parts = ['', 'a', 'b', 'café', '%2F', ':id', ':name', ':last?', ':file.json', '*'];
    const values = ['', 'a', 'b', 'café', '%2F', '%ZZ', 'x.json', 'x.json.json'];
    for (let sample = 0; sample < 250; sample += 1) {
      const patterns = new Set(['/']);
      const paths = ['/', '', '//', '///'];
      for (let route = 0; route < 30; route += 1) {
        let pattern = '';
        let path = '';
        const depth = 1 + next(5);
        for (let index = 0; index < depth; index += 1) {
          pattern += `/${select(parts, next)}`;
          path += `/${select(values, next)}`;
        }
        if (next(2)) pattern += '/';
        if (next(2)) path += '/';
        // Empty compiled patterns cannot be matched by matchit itself.
        if (parse(pattern).length) patterns.add(pattern);
        paths.push(path);
      }
      const bridge = new Bridge();
      const reference = [...patterns].map(parse);
      for (const pattern of patterns) bridge.get(pattern, () => pattern);
      bridge.prepare();
      assert.deepEqual(bridge.routes.GET, reference);
      for (const path of paths) {
        const expected = match(path, reference);
        const actual = bridge.fetch('GET', path);
        const context = `sample ${sample}, path ${JSON.stringify(path)}, routes ${JSON.stringify([...patterns])}`;
        if (expected.length) {
          assert.equal(actual?.stack[0](), expected[0].old, context);
          assert.deepEqual(actual.params, exec(path, expected), context);
        } else assert.equal(actual, null, context);
      }
    }
  });

  it('preserves parameter names and raw values without assigning the object prototype', () => {
    const bridge = new Bridge();
    bridge.get('/:__proto__/:constructor/:名字', () => {});
    const { params } = bridge.fetch('GET', '/%2F/%ZZ/%E9%9B%AA');
    assert.equal(Object.getPrototypeOf(params), Object.prototype);
    assert.deepEqual(Object.keys(params), ['__proto__', 'constructor', '名字']);
    assert.equal(params.__proto__, '%2F');
    assert.equal(params.constructor, '%ZZ');
    assert.equal(params.名字, '%E9%9B%AA');
  });

  it('does not share writable segment records between compiler invocations', () => {
    const first = parseRoute('/a/:id');
    const second = parseRoute('/a/:id');
    assert.notEqual(first, second);
    assert.notEqual(first[0], second[0]);
    first[1].val = 'changed';
    assert.equal(second[1].val, 'id');
  });

  it('keeps empty compiled routes unmatchable without shadowing valid routes', () => {
    const bridge = new Bridge();
    const unexpected = () => assert.fail('an empty route must not match');
    const handler = () => {};
    bridge.get('', unexpected).get('//', unexpected).get('/present', handler);
    for (const path of ['', '/', '//', '///', '/missing']) assert.equal(bridge.fetch('GET', path), null, path);
    assert.deepEqual(bridge.fetch('GET', '/present').stack, [handler]);
    bridge.get('/', handler);
    assert.deepEqual(bridge.fetch('GET', '/').stack, [handler]);
  });
}
