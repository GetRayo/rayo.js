const http = require('http');
const { createReadStream } = require('fs');
const { PassThrough } = require('stream');
const rayo = require('../../packages/rayo');
const compress = require('../../packages/compress');
const payload = require('./fixtures/payload.json');

const ray = rayo({
  port: 5050,
  storm: {
    workers: 2,
    monitor: true,
    keepAlive: true,
    master() {
      process.stdout.write('I am the master!');
    }
  }
});

/**
 * No compression on this endpoint.
 */
ray.bridge('/').get((req, res) => res.send(payload));

/**
 * Compression on this endpoint, piped to the response.
 * Note that the header needs to be set so `compress` can figure out whether
 * the response can be compressed or not.
 */
ray
  .bridge('/pipe')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    createReadStream(`${__dirname}/fixtures/payload.json`).pipe(res);
  });

ray
  .bridge('/pipe-sm')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const bufferStream = new PassThrough();
    bufferStream.pipe(res);
    bufferStream.end(Buffer.from(JSON.stringify(payload)));
  });

/**
 * Compression on this endpoint, sent (`res.send()`) to the response.
 * The header is guessed by `res.send()`.
 */
ray
  .bridge('/send')
  .through(compress())
  .get((req, res) => res.send(payload));

/**
 * Compression on this endpoint, "ended" with the response.
 * Note that the header needs to be set so `compress` can figure out whether
 * the response can be compressed or not.
 */
ray
  .bridge('/end')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  });

/**
 * Compression on this endpoint.
 * "written" to -and "ended" with the response.
 */
ray
  .bridge('/write-compress')
  .through(compress())
  .get((req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.write('Hello!');
    res.end('I am compressed!');
  });

/**
 * No compression (since there's no header) on this endpoint.
 * written to the response and "ended".
 */
ray
  .bridge('/write')
  .through(compress())
  .get((req, res) => {
    res.write('Hello, I have not Content-Type.');
    res.end();
  });

/**
 * No compression (since there's no header) on this endpoint.
 * "ended" with the response.
 */
ray
  .bridge('/end-plain')
  .through(compress())
  .get((req, res) => {
    res.end('Hello, I have not Content-Type.');
  });

/**
 * No compression (images are not "compressible") on this endpoint.
 * piped with the response.
 */
ray.bridge('/img').get((req, res) => {
  const image = http.request(
    {
      host: 'img-aws.ehowcdn.com',
      path: '/600x600p/photos.demandstudios.com/getty/article/165/76/87490163.jpg'
    },
    (response) => {
      res.setHeader('Content-Type', response.headers['content-type']);
      response.pipe(res);
    }
  );

  image.end();
});

ray.start((address) => {
  process.stdout.write(`Up on port ${address.port}`);
});
