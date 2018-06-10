const should = require('should');
const sinon = require('sinon');
const request = require('supertest');
const { createServer } = require('http');
const { PassThrough } = require('stream');
const compress = require('../../../packages/plugins/compress');

const press = (handler, options) =>
  createServer((req, res) =>
    compress(options)(
      req,
      res,
      (error) => (error ? res.end(error.message) : handler(req, res))
    )
  );
const header = (key = null, value = null) => (res) => {
  should(res).be.an.Object();
  should(res.headers).be.an.Object();

  if (value) {
    should(res.headers).with.property(key);
    should(res.headers[key])
      .be.a.String()
      .and.equal(value);
  } else {
    should.not.exist(res.headers[key]);
  }
};
const matchSize = (size) => (res) => {
  should(res.text.length)
    .be.a.Number()
    .and.equal(size);
};

let sandbox;
module.exports = () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('no gzip content-encoding', (done) => {
    request(press((req, res) => res.end('Thunderstruck!')))
      .get('/')
      .set('accept-encoding', 'text/plain')
      .expect(header('content-encoding'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('no accept-encoding', (done) => {
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('Thunderstruck!');
    });

    request(step)
      .get('/')
      .set('accept-encoding', '')
      .expect(header('content-encoding'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('content-length', (done) => {
    request(press((req, res) => res.end('Thunderstruck!')))
      .get('/')
      .expect(header('content-length', '14'))
      .expect(200, done);
  });

  it('content-encoding already set', (done) => {
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.setHeader('content-encoding', 'thunderZip');
      res.end('Thunderstruck!');
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'thunderZip'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('transfer-encoding', (done) => {
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('Thunderstruck!');
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(200, done);
  });

  it('no content-length', (done) => {
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('Thunderstruck!');
    });

    request(step)
      .get('/')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('content-length'))
      .expect(200, done);
  });

  it('res.write() -without header and res.end() -without data', (done) => {
    const step = press((req, res) => {
      res.write('Hello!');
      res.end();
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(200, done);
  });

  it('res.write() and res.end() -without data', (done) => {
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.write('Hello!');
      res.end();
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(200, 'Hello!', done);
  });

  it('res.write() and res.end() -with data', (done) => {
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.write('Hello! ');
      res.end('I am compressed!');
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(200, 'Hello! I am compressed!', done);
  });

  it('1 Mb body', (done) => {
    const body = Buffer.alloc(1000000, '.');
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end(body);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(matchSize(body.length))
      .expect(200, done);
  });

  it('10 Mb body', (done) => {
    const body = Buffer.alloc(1e7, '.');
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end(body);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(matchSize(body.length))
      .expect(200, done);
  });

  it('10 Mb body, with 1 Kb compression chunks', (done) => {
    const body = Buffer.alloc(1e7, '.');
    const step = press(
      (req, res) => {
        res.setHeader('Content-Type', 'text/plain');
        res.end(body);
      },
      { chunkSize: 1024 }
    );

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(matchSize(body.length))
      .expect(200, done);
  });

  it('pipe, 1 Mb body', (done) => {
    const body = Buffer.alloc(1000000, '.');
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      const bufferStream = new PassThrough();
      bufferStream.pipe(res);
      bufferStream.end(body);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(matchSize(body.length))
      .expect(200, done);
  });

  it('pipe, 10 Mb body', (done) => {
    const body = Buffer.alloc(1e7, '.');
    const step = press((req, res) => {
      res.setHeader('content-type', 'text/plain');
      const bufferStream = new PassThrough();
      bufferStream.pipe(res);
      bufferStream.end(body);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(matchSize(body.length))
      .expect(200, done);
  });

  it('pipe, 10 Mb body with 1 Kb compression chunks', (done) => {
    const body = Buffer.alloc(1e7, '.');
    const step = press(
      (req, res) => {
        res.setHeader('content-type', 'text/plain');
        const bufferStream = new PassThrough();
        bufferStream.pipe(res);
        bufferStream.end(body);
      },
      { chunkSize: 1024 }
    );

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(matchSize(body.length))
      .expect(200, done);
  });

  it('res.end() .json', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = press((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-type', 'application/json'))
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(200, json, done);
  });

  it('vary header', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = press((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-type', 'application/json'))
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(header('vary', 'content-encoding'))
      .expect(200, json, done);
  });

  it('vary header, set single', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = press((req, res) => {
      res.setHeader('vary', 'content-type');
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-type', 'application/json'))
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(header('vary', 'content-type, content-encoding'))
      .expect(200, json, done);
  });

  it('vary header, set multiple', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = press((req, res) => {
      res.setHeader('vary', 'content-type, transfer-encoding');
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-type', 'application/json'))
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(header('vary', 'content-type, transfer-encoding, content-encoding'))
      .expect(200, json, done);
  });

  it('vary header, set multiple (content-encoding set)', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = press((req, res) => {
      res.setHeader('vary', 'content-type, transfer-encoding, content-encoding');
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(header('content-type', 'application/json'))
      .expect(header('content-encoding', 'gzip'))
      .expect(header('transfer-encoding', 'chunked'))
      .expect(header('vary', 'content-type, transfer-encoding, content-encoding'))
      .expect(200, json, done);
  });
};
