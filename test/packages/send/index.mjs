import { readFileSync } from 'fs';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import should from 'should';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';
import send from '../../../packages/send/index.js';
import compress from '../../../packages/compress/index.js';
import helpers from '../../utils/helpers.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sampleJSON = readFileSync(path.join(directory, '../../samples/data.json'), 'utf8');

const response = (headers = {}) => {
  const res = {
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    end(payload) {
      this.body = payload;
    }
  };
  send()({}, res, () => {});
  return res;
};

export default function sendTest() {
  it('counts UTF-8 bytes without truncating text', async () => {
    const payload = 'Olá 🌩️';
    await request(helpers.wrap(send, (req, res) => res.send(payload)))
      .get('/')
      .expect('content-length', String(Buffer.byteLength(payload)))
      .expect(200, payload);
  });

  it('sends Buffer bytes unchanged', async () => {
    const payload = Buffer.from([0, 255, 128, 42]);
    const result = await request(helpers.wrap(send, (req, res) => res.send(payload)))
      .get('/')
      .expect('content-type', 'application/octet-stream')
      .expect('content-length', '4')
      .expect(200);
    assert.deepEqual(result.body, payload);
  });

  it('converts primitive payloads and preserves empty null/undefined responses', () => {
    for (const [payload, expected] of [
      [0, '0'],
      [42, '42'],
      [false, 'false'],
      [true, 'true'],
      [NaN, 'NaN'],
      [12n, '12'],
      [null, ''],
      [undefined, '']
    ]) {
      const res = response();
      res.send(payload);
      assert.equal(res.body, expected);
      assert.equal(res.getHeader('content-length'), Buffer.byteLength(expected));
      assert.equal(res.getHeader('content-type'), 'text/plain; charset=utf-8');
    }
  });

  it('preserves automatic detection for JSON values and malformed JSON', () => {
    for (const payload of ['{}', '[]', '"hello"', '123', '-1.2e+3', 'true', 'false', 'null', '\t\r\n {"a":1} ']) {
      const res = response();
      res.send(payload);
      assert.equal(res.body, payload);
      assert.equal(res.getHeader('content-type'), 'application/json; charset=utf-8');
    }
    for (const payload of ['hello', 'true-ish', '{"unfinished":', '\ufeff{}', '']) {
      const res = response();
      res.send(payload);
      assert.equal(res.body, payload);
      assert.equal(res.getHeader('content-type'), 'text/plain; charset=utf-8');
    }
  });

  it('skips JSON parsing for explicit content types and response helpers', () => {
    const parse = sinon.stub(JSON, 'parse').throws(new Error('Unexpected JSON parsing'));
    try {
      const explicit = response({ 'content-type': 'application/problem+json' });
      explicit.send('{"message":"known JSON"}');
      assert.equal(explicit.getHeader('content-type'), 'application/problem+json');
      const text = response();
      text.text('true');
      assert.equal(text.body, 'true');
      assert.equal(text.getHeader('content-type'), 'text/plain; charset=utf-8');
      const serialized = response();
      serialized.jsonString('{"message":"known JSON"}');
      assert.equal(serialized.body, '{"message":"known JSON"}');
      assert.equal(serialized.getHeader('content-type'), 'application/json; charset=utf-8');
      const object = response();
      object.json({ hello: 'world' });
      assert.equal(object.body, '{"hello":"world"}');
      assert.equal(parse.callCount, 0);
    } finally {
      parse.restore();
    }
  });

  it('serializes explicit JSON once and handles JSON primitive values', () => {
    let serializations = 0;
    const res = response();
    res.json({
      toJSON() {
        serializations += 1;
        return { city: 'Zürich' };
      }
    });
    assert.equal(serializations, 1);
    assert.equal(res.body, '{"city":"Zürich"}');
    assert.equal(res.getHeader('content-length'), Buffer.byteLength(res.body));
    for (const [payload, expected] of [
      ['hello', '"hello"'],
      [false, 'false'],
      [0, '0'],
      [null, 'null'],
      [undefined, '']
    ]) {
      const current = response();
      current.json(payload);
      assert.equal(current.body, expected);
    }
    assert.throws(() => response().jsonString({}), TypeError);
    const circular = {};
    circular.self = circular;
    assert.throws(() => response().json(circular), TypeError);
  });

  it('uses independent response state with shared helper functions', () => {
    const first = response({ 'x-powered-by': 'rayo' });
    const second = response();
    assert.equal(first.text, second.text);
    assert.equal(first.json, second.json);
    first.text('first', 201, 'Created by Rayo');
    second.text('second');
    assert.equal(first.body, 'first');
    assert.equal(second.body, 'second');
    assert.equal(first.statusCode, 201);
    assert.equal(first.statusMessage, 'Created by Rayo');
    assert.equal(first.getHeader('x-powered-by'), '@rayo/send, rayo');
    assert.equal(second.getHeader('x-powered-by'), '@rayo/send');
  });

  it('preserves response binding when the original send helper is extracted', () => {
    const first = response();
    const second = response();
    const firstReply = first.send;
    const secondReply = second.send;
    firstReply('first', 201);
    secondReply('second', 202);
    assert.equal(first.body, 'first');
    assert.equal(first.statusCode, 201);
    assert.equal(second.body, 'second');
    assert.equal(second.statusCode, 202);
  });

  it('compresses explicit and automatic responses in either middleware order', async () => {
    const text = 'Olá 🌩️'.repeat(400);
    const serialized = JSON.stringify({ text });
    for (const order of [
      [send(), compress()],
      [compress(), send()]
    ]) {
      for (const [method, payload, expected] of [
        ['send', text, text],
        ['text', text, text],
        ['json', { text }, serialized],
        ['jsonString', serialized, serialized]
      ]) {
        const middleware = () => (req, res, next) => order[0](req, res, () => order[1](req, res, next));
        await request(helpers.wrap(middleware, (req, res) => res[method](payload)))
          .get('/')
          .set('accept-encoding', 'gzip')
          .expect('content-encoding', 'gzip')
          .expect('vary', 'Accept-Encoding')
          .expect(helpers.header('content-length'))
          .expect(200, expected);
      }
    }
  });

  it('send', (done) => {
    should(send()).be.a.Function();
    done();
  });

  it('send, without payload, without status code', (done) => {
    request(helpers.wrap(send, (req, res) => res.send()))
      .get('/')
      .expect(helpers.header('content-type', 'text/plain; charset=utf-8'))
      .expect(200, '', done);
  });

  it('send, text', (done) => {
    request(helpers.wrap(send, (req, res) => res.send('Thunderstruck!')))
      .get('/')
      .expect(helpers.header('content-type', 'text/plain; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('send, text and status', (done) => {
    request(helpers.wrap(send, (req, res) => res.send('Thunderstruck!', 404)))
      .get('/')
      .expect(helpers.header('content-type', 'text/plain; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(404, 'Thunderstruck!', done);
  });

  it('send, html', (done) => {
    request(
      helpers.wrap(send, (req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.send('Thunderstruck!');
      })
    )
      .get('/')
      .expect(helpers.header('content-type', 'text/html; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('send, html and status', (done) => {
    request(
      helpers.wrap(send, (req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.send('Thunderstruck!', 404);
      })
    )
      .get('/')
      .expect(helpers.header('content-type', 'text/html; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(404, 'Thunderstruck!', done);
  });

  it('send, json', (done) => {
    request(helpers.wrap(send, (req, res) => res.send({ status: 'Thunderstruck!' })))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(200, '{"status":"Thunderstruck!"}', done);
  });

  it('send, json and status', (done) => {
    request(helpers.wrap(send, (req, res) => res.send({ status: 'Thunderstruck!' }, 404)))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(404, '{"status":"Thunderstruck!"}', done);
  });

  it('send, json (large)', (done) => {
    request(helpers.wrap(send, (req, res) => res.send(sampleJSON)))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(200, done);
  });

  it('send, json (large) and status', (done) => {
    request(helpers.wrap(send, (req, res) => res.send(sampleJSON, 404)))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(404, done);
  });
}
