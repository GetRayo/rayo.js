/* eslint import/extensions: 0 */

import path from 'path';
import should from 'should';
import request from 'supertest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { PassThrough } from 'stream';
import compress from '../../../packages/compress/index.js';
import helpers from '../../utils/helpers.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sampleJSON = readFileSync(path.join(directory, '../../samples/data.json'), 'utf8');

export default function compressTest() {
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
    const step = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end('Thunderstruck!');
      },
      { threshold: 8 }
    );

    request(step)
      .get('/')
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('content-length'))
      .expect(200, done);
  });

  it('below threshold', (done) => {
    const step = helpers.wrap(compress, (req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('Thunderstruck!');
    });

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-length', '14'))
      .expect(helpers.header('x-skip-compression', 'below threshold'))
      .expect(200, done);
  });

  it('vary header', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(json);
      },
      { threshold: 8 }
    );

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
    const step = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('vary', 'content-type');
        res.setHeader('content-type', 'application/json');
        res.end(json);
      },
      { threshold: 8 }
    );

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
    const step = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('vary', 'content-type, transfer-encoding');
        res.setHeader('content-type', 'application/json');
        res.end(json);
      },
      { threshold: 8 }
    );

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
    const step = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('vary', 'content-type, transfer-encoding, content-encoding');
        res.setHeader('content-type', 'application/json');
        res.end(json);
      },
      { threshold: 8 }
    );

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
    const step = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('vary', '*');
        res.setHeader('content-type', 'application/json');
        res.end(json);
      },
      { threshold: 8 }
    );

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-type', 'application/json'))
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('transfer-encoding', 'chunked'))
      .expect(helpers.header('vary', '*'))
      .expect(200, json, done);
  });

  it('invalid chunk size, invalid level', (done) => {
    const json = JSON.stringify({
      message: 'Thunderstruck',
      age: 20,
      name: 'Rayo',
      power: 'reduction'
    });
    const step = helpers.wrap(
      compress,
      (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(json);
      },
      { threshold: 8, chunkSize: 'wrong', level: 'wrong' }
    );

    request(step)
      .get('/')
      .set('accept-encoding', 'gzip')
      .expect(helpers.header('content-type', 'application/json'))
      .expect(helpers.header('content-encoding', 'gzip'))
      .expect(helpers.header('transfer-encoding', 'chunked'))
      .expect(200, json, done);
  });

  describe('gzip', () => {
    it('non-compressible type, write', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/rayo');
        res.write('Thunderstruck!');
        res.end();
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'text/rayo'))
        .expect(200, 'Thunderstruck!', done);
    });

    it('non-compressible type, end', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/rayo');
        res.end('Thunderstruck!');
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'text/rayo'))
        .expect(200, 'Thunderstruck!', done);
    });

    it('content-encoding, transfer-encoding', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end('Thunderstruck!');
        },
        { threshold: 8 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.header('x-powered-by', '@rayo/compress'))
        .expect(200, done);
    });

    it('res.write() -without header and res.end() -without data', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.write('Hello!');
          res.end();
        },
        { threshold: 4 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, done);
    });

    it('res.write() and res.end() -without data', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.write('Hello!');
          res.end();
        },
        { threshold: 4 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, 'Hello!', done);
    });

    it('res.write() and res.end() -with data', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.write('Hello! ');
          res.end('I am compressed!');
        },
        { threshold: 4 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, 'Hello! I am compressed!', done);
    });

    it('1 Mb body', (done) => {
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

    it('1 Mb body, prefer gzip', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end(body);
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip, br')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('1 Mb body, level 3', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 3 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('1 Mb body, level 9', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 9 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('1 Mb body, level 15 (will set down to `9`)', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 15 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('10 Mb body', (done) => {
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

    it('10 Mb body, level 3', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 3 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('10 Mb body, level 9', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 9 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('pipe, 1 Mb body', (done) => {
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

    it('pipe, 10 Mb body', (done) => {
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

    it('10 Mb body, with 1 Kb compression chunks', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('Content-Type', 'text/plain');
          res.end(body);
        },
        { chunkSize: 1 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('pipe, 10 Mb body with 4 Kb compression chunks', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { chunkSize: 4 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('pipe, 10 Mb body with 32 Kb compression chunks', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { chunkSize: 32 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(helpers.size(body.length))
        .expect(200, done);
    });

    it('res.end() .json (inline)', (done) => {
      const json = JSON.stringify({
        message: 'Thunderstruck',
        age: 20,
        name: 'Rayo',
        power: 'reduction'
      });
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'application/json');
          res.end(json);
        },
        { threshold: 8 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'application/json'))
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, json, done);
    });

    it('res.end() .json (file)', (done) => {
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

    it('res.end() .csv', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/csv');
        res.end(readFileSync(path.join(directory, '../../samples/data.csv'), 'utf8'));
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'text/csv'))
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, done);
    });

    it('res.end() .xml', (done) => {
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'application/xml');
        res.end(readFileSync(path.join(directory, '../../samples/data.xml'), 'utf8'));
      });

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'application/xml'))
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, done);
    });

    it('res.end() .html', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/html');
          res.end(readFileSync(path.join(directory, '../../samples/data.html'), 'utf8'));
        },
        { threshold: 4 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'gzip')
        .expect(helpers.header('content-type', 'text/html'))
        .expect(helpers.header('content-encoding', 'gzip'))
        .expect(helpers.header('transfer-encoding', 'chunked'))
        .expect(200, done);
    });
  });

  describe('brotli', () => {
    it('non-compressible type, write', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/rayo');
          res.write('Thunderstruck!');
          res.end();
        },
        { threshold: 4 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'br')
        .expect(helpers.header('content-type', 'text/rayo'))
        .expect(200, 'Thunderstruck!', done);
    });

    it('non-compressible type, end', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/rayo');
          res.end('Thunderstruck!');
        },
        { threshold: 4 }
      );

      request(step)
        .get('/')
        .set('accept-encoding', 'br')
        .expect(helpers.header('content-type', 'text/rayo'))
        .expect(200, 'Thunderstruck!', done);
    });

    it('content-encoding, transfer-encoding', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end('Thunderstruck!');
        },
        { threshold: 4 }
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
          should(data).be.equal('Thunderstruck!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.write() -without header and res.end() -without data', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.write('Hello!');
          res.end();
        },
        { threshold: 4 }
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
          should(data).be.equal('Hello!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.write() and res.end() -without data', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.write('Hello!');
          res.end();
        },
        { threshold: 4 }
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
          should(data).be.equal('Hello!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.write() and res.end() -with data', (done) => {
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.write('Hello! ');
          res.end('I am compressed!');
        },
        { threshold: 4 }
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
          should(data).be.equal('Hello! I am compressed!');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('1 Mb body', (done) => {
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

    it('1 Mb body, prefer brotli', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { preferBrotli: true }
      );

      step.listen();
      const { port } = step.address();
      helpers
        .request({
          port,
          host: 'localhost',
          path: '/',
          headers: { 'accept-encoding': 'gzip, br' }
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

    it('1 Mb body, level 3', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 3 }
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

    it('1 Mb body, level 10', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 10 }
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

    it('1 Mb body, level 15 (will set down to `11`)', (done) => {
      const body = Buffer.alloc(1000000, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 15 }
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

    it('10 Mb body', (done) => {
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

    it('10 Mb body, level 3', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 3 }
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

    it('10 Mb body, level 10', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.end(body);
        },
        { level: 10 }
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

    it('pipe, 1 Mb body', (done) => {
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

    it('pipe, 10 Mb body', (done) => {
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

    it('10 Mb body, with 1 Kb compression chunks', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('Content-Type', 'text/plain');
          res.end(body);
        },
        { chunkSize: 1 }
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

    it('pipe, 10 Mb body with 4 Kb compression chunks', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { chunkSize: 4 }
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

    it('pipe, 10 Mb body with 32 Kb compression chunks', (done) => {
      const body = Buffer.alloc(1e7, '.');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          const bufferStream = new PassThrough();
          bufferStream.pipe(res);
          bufferStream.end(body);
        },
        { chunkSize: 32 }
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

    it('res.end() .json (inline)', (done) => {
      const json = JSON.stringify({
        message: 'Thunderstruck',
        age: 20,
        name: 'Rayo',
        power: 'reduction'
      });
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'application/json');
          res.end(json);
        },
        { threshold: 4 }
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

    it('res.end() .json (file)', (done) => {
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

    it('res.end() .csv', (done) => {
      const requestData = readFileSync(path.join(directory, '../../samples/data.csv'), 'utf8');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'text/csv');
        res.end(requestData);
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
          should(data).be.equal(requestData);
          should(headers).with.property('content-type');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-type']).be.a.String().and.equal('text/csv');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.end() .xml', (done) => {
      const requestData = readFileSync(path.join(directory, '../../samples/data.xml'), 'utf8');
      const step = helpers.wrap(compress, (req, res) => {
        res.setHeader('content-type', 'application/xml');
        res.end(requestData);
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
          should(data).be.equal(requestData);
          should(headers).with.property('content-type');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-type']).be.a.String().and.equal('application/xml');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });

    it('res.end() .html', (done) => {
      const requestData = readFileSync(path.join(directory, '../../samples/data.html'), 'utf8');
      const step = helpers.wrap(
        compress,
        (req, res) => {
          res.setHeader('content-type', 'text/html');
          res.end(requestData);
        },
        { threshold: 4 }
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
          should(data).be.equal(requestData);
          should(headers).with.property('content-type');
          should(headers).with.property('content-encoding');
          should(headers).with.property('transfer-encoding');
          should(headers['content-type']).be.a.String().and.equal('text/html');
          should(headers['content-encoding']).be.a.String().and.equal('br');
          should(headers['transfer-encoding']).be.a.String().and.equal('chunked');

          step.close();
          done();
        });
    });
  });
}
