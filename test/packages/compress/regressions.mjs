import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Writable } from 'node:stream';
import request from 'supertest';
import compress from '../../../packages/compress/index.js';
import helpers from '../../utils/helpers.mjs';

// A slow, bounded output sink makes socket backpressure deterministic without
// relying on machine-specific TCP buffer sizes or large allocations.
class Response extends Writable {
  constructor() {
    const chunks = [];
    super({
      highWaterMark: 64,
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        setImmediate(callback);
      }
    });
    this.chunks = chunks;
    this.headers = new Map();
    this.statusCode = 200;
    this.headersSent = false;
    this.setHeader('content-type', 'text/plain');
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  }
  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }
  removeHeader(name) {
    this.headers.delete(name.toLowerCase());
  }
  writeHead(statusCode) {
    this.statusCode = statusCode;
    this.headersSent = true;
    return this;
  }
}

const install = (res, options) =>
  compress(options)({ headers: { 'accept-encoding': 'gzip' }, method: 'GET' }, res, () => {});

export default function regressionTests() {
  it('compresses unknown-length streams from their first small chunk', async () => {
    const body = 'a'.repeat(512) + 'b'.repeat(512);
    const server = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.write(body.slice(0, 512));
      setImmediate(() => res.end(body.slice(512)));
    });
    await request(server)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect('content-encoding', 'gzip')
      .expect('vary', 'Accept-Encoding')
      .expect(200, body);
  });

  it('uses declared total size even when the first chunk is small', async () => {
    const body = 'x'.repeat(2048);
    const server = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.setHeader('content-length', body.length);
      res.write(body.slice(0, 5));
      res.end(body.slice(5));
    });
    await request(server)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect('content-encoding', 'gzip')
      .expect(helpers.header('content-length'))
      .expect(200, body);
  });

  it('keeps known short streamed responses uncompressed', async () => {
    const server = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-length', 10);
      res.write('hello');
      res.end('world');
    });
    await request(server)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-encoding'))
      .expect('content-length', '10')
      .expect(200, 'helloworld');
  });

  it('uses UTF-8 byte length for a one-shot threshold', async () => {
    const server = helpers.wrap(compress, (req, res) => res.end('éé'), { threshold: 4 });
    await request(server).get('/').set('accept-encoding', 'gzip').expect('content-encoding', 'gzip').expect(200, 'éé');
  });

  it('supports explicit writeHead headers and preserves duplicate cookies', async () => {
    const body = 'x'.repeat(2048);
    const server = helpers.wrap(compress, (req, res) => {
      res.writeHead(200, 'OK', [
        'Content-Type',
        'text/plain',
        'Content-Length',
        String(body.length),
        'Set-Cookie',
        'one=1',
        'Set-Cookie',
        'two=2'
      ]);
      res.end(body);
    });
    await request(server)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect('content-encoding', 'gzip')
      .expect(helpers.header('content-length'))
      .expect((res) => assert.deepEqual(res.headers['set-cookie'], ['one=1', 'two=2']))
      .expect(200, body);
  });

  it('commits a single compression decision when headers are flushed', async () => {
    const server = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.flushHeaders();
      res.write('first');
      res.end('last');
    });
    await request(server)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect('content-encoding', 'gzip')
      .expect(200, 'firstlast');
  });

  it('leaves a response whose headers were already sent alone', async () => {
    const middleware = compress();
    const server = helpers.wrap(
      () => (req, res, step) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        middleware(req, res, step);
      },
      (req, res) => res.end('x'.repeat(2048))
    );
    await request(server)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-encoding'))
      .expect(200, 'x'.repeat(2048));
  });

  it('preserves later response wrappers when a stream remains uncompressed', async () => {
    const res = new Response();
    res.setHeader('content-length', 9);
    install(res);
    const { write, end, writeHead } = res;
    const calls = [];
    res.write = function observedWrite(...args) {
      calls.push('write');
      return write.apply(this, args);
    };
    res.end = function observedEnd(...args) {
      calls.push('end');
      return end.apply(this, args);
    };
    res.writeHead = function observedHeaders(...args) {
      calls.push('headers');
      return writeHead.apply(this, args);
    };
    const finished = once(res, 'finish');
    res.writeHead(200);
    res.write('one');
    res.write('two');
    res.end('end');
    await finished;
    assert.deepEqual(calls, ['headers', 'write', 'write', 'end']);
    assert.equal(Buffer.concat(res.chunks).toString(), 'onetwoend');
    assert.equal(res.getHeader('content-encoding'), undefined);
    assert.equal(res.getHeader('vary'), 'Accept-Encoding');
    assert.equal(res.listenerCount('close'), 0);
  });

  for (const [accept, expected] of [
    ['gzip;q=0, br;q=0', null],
    ['GZip;Q=1, br;q=0', 'gzip'],
    ['gzip;q=0.9, br;q=0.2', 'gzip'],
    ['gzip;q=0, *;q=1', 'br'],
    ['gzip;q=0.1, identity;q=1', null],
    ['identity', null],
    ['', null],
    ['gzip;q=invalid, br;q=0', null]
  ]) {
    it(`negotiates ${JSON.stringify(accept)} with quality values`, () => {
      const res = new Response();
      compress({ threshold: 0 })({ headers: { 'accept-encoding': accept }, method: 'GET' }, res, () => {});
      res.end('test');
      assert.equal(res.getHeader('content-encoding'), expected || undefined);
      assert.equal(res.getHeader('vary'), 'Accept-Encoding');
      res.destroy();
    });
  }

  it('selects Brotli by client quality before the server tie-break preference', () => {
    const res = new Response();
    compress({ threshold: 0 })({ headers: { 'accept-encoding': 'gzip;q=0.2, br' }, method: 'GET' }, res, () => {});
    res.end('test');
    assert.equal(res.getHeader('content-encoding'), 'br');
    res.destroy();
  });

  it('merges Vary case-insensitively and preserves array values', async () => {
    const server = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('vary', ['Origin', 'ACCEPT-ENCODING']);
        res.end('test');
      },
      { threshold: 0 }
    );
    await request(server)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect('vary', 'Origin, ACCEPT-ENCODING')
      .expect(200, 'test');
  });

  for (const [name, value] of [
    ['content-encoding', 'custom'],
    ['cache-control', 'public, No-Transform'],
    ['content-range', 'bytes 0-3/100'],
    ['content-type', 'application/octet-stream'],
    ['content-type', 'not-text/plain']
  ]) {
    it(`skips ${name}: ${value}`, () => {
      const res = new Response();
      res.setHeader(name, value);
      install(res, { threshold: 0 });
      res.end('test');
      assert.equal(res.getHeader('content-encoding'), name === 'content-encoding' ? value : undefined);
      res.destroy();
    });
  }

  for (const status of [204, 205, 304]) {
    it(`skips bodyless status ${status}`, async () => {
      const server = helpers.wrap(
        compress,
        (req, res) => {
          res.statusCode = status;
          res.end();
        },
        { threshold: 0 }
      );
      await request(server)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding'))
        .expect(status);
    });
  }

  it('does not compress HEAD responses', async () => {
    const server = helpers.wrap(compress, (req, res) => res.end('test'), { threshold: 0 });
    await request(server)
      .head('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-encoding'))
      .expect(200);
  });

  it('forwards compressor drain to a producer even when the socket never blocks', async () => {
    const res = new Response();
    // A large output buffer isolates compressor input backpressure.
    res._writableState.highWaterMark = 1024 * 1024;
    install(res);
    const body = Buffer.alloc(128 * 1024, 'x');
    const finished = once(res, 'finish');
    assert.equal(res.write(body), false);
    assert.equal(res.writableNeedDrain, true);
    let drains = 0;
    res.on('drain', () => {
      drains += 1;
    });
    // A socket notification must not release a producer while compressor input is full.
    res.emit('drain');
    assert.equal(drains, 0);
    await once(res, 'drain');
    res.end('tail');
    await finished;
    assert.deepEqual(gunzipSync(Buffer.concat(res.chunks)), Buffer.concat([body, Buffer.from('tail')]));
  });

  it('waits for both compression and slow output while streaming incompressible data', async () => {
    const res = new Response();
    const body = randomBytes(256 * 1024);
    install(res, { chunkSize: 1 });
    const finished = once(res, 'finish');
    let pauses = 0;
    for (let offset = 0; offset < body.length; offset += 16384) {
      if (!res.write(body.subarray(offset, offset + 16384))) {
        pauses += 1;
        await once(res, 'drain');
        assert.equal(res.writableNeedDrain, false);
      }
    }
    res.end();
    await finished;
    assert.ok(pauses > 0);
    assert.deepEqual(gunzipSync(Buffer.concat(res.chunks)), body);
    assert.equal(res.listenerCount('close'), 0);
    assert.equal(res.emit, EventEmitter.prototype.emit);
  });

  it('returns the response and calls end callbacks only after output finishes', async () => {
    const res = new Response();
    install(res, { threshold: 0 });
    let calls = 0;
    const completed = new Promise((resolve, reject) => {
      const result = res.end('payload', 'utf8', function completed(error) {
        try {
          assert.ifError(error);
          assert.equal(this, res);
          assert.equal(res.writableFinished, true);
          calls += 1;
          resolve();
        } catch (failure) {
          reject(failure);
        }
      });
      assert.equal(result, res);
      assert.equal(res.writableEnded, true);
    });
    await completed;
    assert.equal(calls, 1);
    assert.equal(gunzipSync(Buffer.concat(res.chunks)).toString(), 'payload');
  });

  it('restores existing response state and keeps event observers through completion', async () => {
    const res = new Response();
    const getter = () => res._writableState.ending;
    Object.defineProperty(res, 'writableEnded', { configurable: true, get: getter });
    install(res, { threshold: 0 });
    // Other middleware can add event observation after compression is installed.
    const emitted = [];
    const observer = function observedEvent(event, ...args) {
      emitted.push(event);
      return EventEmitter.prototype.emit.call(this, event, ...args);
    };
    res.emit = observer;
    let completions = 0;
    await new Promise((resolve, reject) => {
      res.end('payload', (error) => {
        completions += 1;
        if (error) reject(error);
        else resolve();
      });
      assert.equal(res.writableEnded, true);
    });
    res.emit('close');
    assert.equal(completions, 1);
    assert.ok(emitted.includes('finish'));
    assert.ok(emitted.includes('close'));
    assert.equal(res.emit, observer);
    assert.equal(Object.getOwnPropertyDescriptor(res, 'writableEnded').get, getter);
    assert.equal(Object.hasOwn(res, 'writableNeedDrain'), false);
  });

  it('supports end(callback) and end(data, callback) overloads', async () => {
    for (const data of [undefined, 'tail']) {
      const res = new Response();
      install(res, { threshold: 0 });
      res.write('head');
      await new Promise((resolve, reject) => {
        const callback = (error) => (error ? reject(error) : resolve());
        if (data === undefined) res.end(callback);
        else res.end(data, callback);
      });
      assert.equal(gunzipSync(Buffer.concat(res.chunks)).toString(), `head${data || ''}`);
    }
  });

  it('uncorks output when end() is called', async () => {
    const res = new Response();
    install(res);
    const body = randomBytes(128 * 1024);
    res.cork();
    const finished = once(res, 'finish');
    res.write(body);
    res.end();
    await finished;
    assert.deepEqual(gunzipSync(Buffer.concat(res.chunks)), body);
  });

  it('handles compressor errors and fails pending completion callbacks', async () => {
    const res = new Response();
    install(res, { threshold: 0 });
    const completion = new Promise((resolve) => res.end('first', resolve));
    res.end('second');
    const error = await completion;
    assert.equal(error.code, 'ERR_STREAM_WRITE_AFTER_END');
    assert.equal(res.destroyed, true);
    assert.equal(res.listenerCount('close'), 0);
  });

  it('releases compression and pending end callbacks after a disconnect', async () => {
    const res = new Response();
    install(res);
    const completion = new Promise((resolve) => res.end(randomBytes(256 * 1024), resolve));
    res.destroy();
    const error = await completion;
    assert.equal(error.code, 'ERR_STREAM_PREMATURE_CLOSE');
    assert.equal(res.listenerCount('close'), 0);
    assert.equal(res.listenerCount('error'), 0);
    assert.equal(res.emit, EventEmitter.prototype.emit);
  });

  it('cleans up after an output error without leaving compression active', async () => {
    const res = new Response();
    const failure = new Error('socket failed');
    res._write = (data, encoding, callback) => callback(failure);
    install(res, { threshold: 0 });
    const error = await new Promise((resolve) => res.end('payload', resolve));
    assert.equal(error, failure);
    assert.equal(res.destroyed, true);
    assert.equal(res.listenerCount('close'), 0);
  });
}
