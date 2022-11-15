/* eslint import/extensions: 0 */

import path from 'path';
import sinon from 'sinon';
import should from 'should';
import request from 'supertest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { PassThrough } from 'stream';
import compress from '../../../packages/compress/index.js';
import helpers from '../../utils/helpers.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sampleJSON = readFileSync(path.join(directory, '../../utils/sample.json'), 'utf8');

let sandbox;
export default function compressTest() {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('no compressed, content-encoding', (done) => {
    request(helpers.wrap(compress, (req, res) => res.end('Thunderstruck!')))
      .get('/')
      .set('accept-encoding', 'text/plain')
      .expect(helpers.header('content-encoding'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('no accept-encoding', (done) => {
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('Thunderstruck!');
    });

    request(step)
      .get('/')
      .set('accept-encoding', '')
      .expect(helpers.header('content-encoding'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('no content-length', (done) => {
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('Thunderstruck!');
    });

    request(step)
      .get('/')
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('content-length'))
      .expect(200, done);
  });

  describe('gzip', () => {
    it('content-encoding, transfer-encoding, gzip', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end('Thunderstruck!');
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.header('x-powered-by', '@rayo/compress'))
        .expect(200, done);
    });

    it('res.write() -without header and res.end() -without data, gzip', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.write('Hello!');
        res.end();
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, done);
    });

    it('res.write() and res.end() -without data, gzip', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.write('Hello!');
        res.end();
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, 'Hello!', done);
    });

    it('res.write() and res.end() -with data, gzip', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.write('Hello! ');
        res.end('I am compressed!');
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, 'Hello! I am compressed!', done);
    });

    it('1 Mb body, gzip', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end(body);
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('10 Mb body, gzip', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end(body);
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('pipe, 1 Mb body, gzip', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        const bufferStream = new PassThrough();
        bufferStream.pipe(res);
        bufferStream.end(body);
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('pipe, 10 Mb body, gzip', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        const bufferStream = new PassThrough();
        bufferStream.pipe(res);
        bufferStream.end(body);
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('10 Mb body, with 1 Kb compression chunks, gzip', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('Content-Type', 'text/plain');
          res.end(body);
        },
        { gzip: { chunkSize: 1024 } }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('pipe, 10 Mb body with 4 Kb compression chunks, gzip', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { gzip: { chunkSize: 4096 } }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('pipe, 10 Mb body with 32 Kb compression chunks, gzip', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { gzip: { chunkSize: 32768 } }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('res.end() .json, gzip', (done) => {
      const json = JSON.stringify({
        message: 'Thunderstruck',
        age: 20,
        name: 'Rayo',
        power: 'reduction'
      });
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(json);
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'application/json'))
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, json, done);
    });

    it('res.end() .json (large), gzip', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(sampleJSON);
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'application/json'))
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, done);
    });
  });

  describe('brotli', () => {
    it('content-encoding, transfer-encoding, brotli', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end('Thunderstruck!');
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data).be.equal('Thunderstruck!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.write() -without header and res.end() -without data, brotli', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.write('Hello!');
        res.end();
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data).be.equal('Hello!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.write() and res.end() -without data, brotli', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.write('Hello!');
        res.end();
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data).be.equal('Hello!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.write() and res.end() -with data, brotli', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.write('Hello! ');
        res.end('I am compressed!');
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data).be.equal('Hello! I am compressed!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('1 Mb body, brotli', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end(body);
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data.length).be.equal(body.length);
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('10 Mb body, brotli', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end(body);
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data.length).be.equal(body.length);
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('pipe, 1 Mb body, brotli', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        const bufferStream = new PassThrough();
        bufferStream.pipe(res);
        bufferStream.end(body);
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data.length).be.equal(body.length);
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('pipe, 10 Mb body, brotli', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        const bufferStream = new PassThrough();
        bufferStream.pipe(res);
        bufferStream.end(body);
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data.length).be.equal(body.length);
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('10 Mb body, with 1 Kb compression chunks, brotli', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('Content-Type', 'text/plain');
          res.end(body);
        },
        { brotli: { chunkSize: 1024 } }
      );

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data.length).be.equal(body.length);
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('pipe, 10 Mb body with 4 Kb compression chunks, brotli', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { brotli: { chunkSize: 4096 } }
      );

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data.length).be.equal(body.length);
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('pipe, 10 Mb body with 32 Kb compression chunks, brotli', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { brotli: { chunkSize: 32768 } }
      );

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data.length).be.equal(body.length);
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.end() .json, brotli', (done) => {
      const json = JSON.stringify({
        message: 'Thunderstruck',
        age: 20,
        name: 'Rayo',
        power: 'reduction'
      });
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(json);
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data).be.equal(json);
          should(headers).with.property('content-type');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-type']).be.a.String().and.equal('application/json');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.end() .json (large), brotli', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(sampleJSON);
      });

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'br' }
        })
        .then(({ status, headers, data }) => {
          should(status).be.equal(200);
          should(data).be.equal(sampleJSON);
          should(headers).with.property('content-type');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-type']).be.a.String().and.equal('application/json');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });
  });

  it('vary header', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-type', 'application/json'))
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('transfer-encoding', 'chunked'))
      .expect(helpers.header('vary', 'content-encoding'))
      .expect(200, json, done);
  });

  it('vary header, set single', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('vary', 'content-type');
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-type', 'application/json'))
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('transfer-encoding', 'chunked'))
      .expect(helpers.header('vary', 'content-type, content-encoding'))
      .expect(200, json, done);
  });

  it('vary header, set multiple', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('vary', 'content-type, transfer-encoding');
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-type', 'application/json'))
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('transfer-encoding', 'chunked'))
      .expect(helpers.header('vary', 'content-type, transfer-encoding, content-encoding'))
      .expect(200, json, done);
  });

  it('vary header, set multiple (content-encoding set)', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('vary', 'content-type, transfer-encoding, content-encoding');
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-type', 'application/json'))
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('transfer-encoding', 'chunked'))
      .expect(helpers.header('vary', 'content-type, transfer-encoding, content-encoding'))
      .expect(200, json, done);
  });

  it('vary header, *', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('vary', '*');
      res.setHeader('content-type', 'application/json');
      res.end(json);
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-type', 'application/json'))
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('transfer-encoding', 'chunked'))
      .expect(helpers.header('vary', '*'))
      .expect(200, json, done);
  });
}
