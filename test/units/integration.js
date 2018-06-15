const http = require('http');
const should = require('should');
const rayo = require('../../packages/rayo');
const send = require('../../packages/plugins/send');

const request = (resolver, options = {}) =>
  new Promise((yes) => {
    options.port = options.port || 5050;
    options.path = options.path || '/';
    options.method = options.method || 'GET';

    const req = http.request(options, (res) => {
      res.on('data', resolver.bind(null, res.headers, res.statusCode));
      res.on('end', yes);
    });

    req.end();
  });
const test = (options = {}, headers, status, body) => {
  options.statusCode = options.statusCode || 200;
  options.headers = options.headers || 'text/plain';

  if (headers['content-type']) {
    should(headers['content-type']).be.a.String();
    should(headers['content-type']).be.equal(options.headers);
  }

  should(parseInt(headers['content-length'], 10)).be.equal(options.contentLength);
  should(status).be.a.Number();
  should(status).be.equal(options.statusCode);
  should(body.toString()).be.equal(options.body);
};

module.exports = () => {
  it('GET request', (done) => {
    const server = rayo({ port: 5050 })
      .get('/', (req, res) => res.end('Thunderstruck!'))
      .start();

    request(test.bind(null, { contentLength: 14, body: 'Thunderstruck!' })).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, with middleware', (done) => {
    const server = rayo({ port: 5050 })
      .get(
        '/',
        (req, res, step) => {
          req.middlware = 'I was here';
          step();
        },
        (req, res) => res.end(`${req.middlware} and I was thunderstruck!`)
      )
      .start();

    request(
      test.bind(null, {
        contentLength: 35,
        body: 'I was here and I was thunderstruck!'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(text/plain)', (done) => {
    const server = rayo({ port: 5050 })
      .through(send())
      .get('/', (req, res) => res.send('Thunderstruck!'))
      .start();

    request(test.bind(null, { contentLength: 14, body: 'Thunderstruck!' })).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(text/plain), status code', (done) => {
    const server = rayo({ port: 5050 })
      .through(send())
      .get('/', (req, res) => res.send('Thunderstruck!', 204))
      .start();

    request(
      test.bind(null, {
        contentLength: 14,
        statusCode: 204,
        body: 'Thunderstruck!'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(application/json)', (done) => {
    const server = rayo({ port: 5050 })
      .through(send())
      .get('/', (req, res) => res.send({ message: 'Thunderstruck!' }))
      .start();

    request(
      test.bind(null, {
        contentLength: 28,
        headers: 'application/json',
        body: '{"message":"Thunderstruck!"}'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(application/json), status code', (done) => {
    const server = rayo({ port: 5050 })
      .through(send())
      .get('/', (req, res) => res.send({ message: 'Thunderstruck!' }, 204))
      .start();

    request(
      test.bind(null, {
        contentLength: 28,
        headers: 'application/json',
        statusCode: 204,
        body: '{"message":"Thunderstruck!"}'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('Bridged GET, POST request', (done) => {
    const ray = rayo({ port: 5050 });
    ray
      .bridge('/')
      .get((req, res) => res.end('GET'))
      .post((req, res) => res.end('POST'));

    const server = ray.start();

    request(
      test.bind(null, {
        contentLength: 3,
        body: 'GET'
      })
    )
      .then(() =>
        request(
          test.bind(null, {
            contentLength: 4,
            body: 'POST'
          }),
          { method: 'POST' }
        )
      )
      .then(() => {
        server.close();
        done();
      });
  });

  it('Bridged GET, POST request, with middleware', (done) => {
    const ray = rayo({ port: 5050 });
    ray
      .bridge('/')
      .get(
        (req, res, step) => {
          req.middlware = 'GET +';
          step();
        },
        (req, res) => res.end(`${req.middlware} GET`)
      )
      .post(
        (req, res, step) => {
          req.middlware = 'POST +';
          step();
        },
        (req, res) => res.end(`${req.middlware} POST`)
      );

    const server = ray.start();

    request(
      test.bind(null, {
        contentLength: 9,
        body: 'GET + GET'
      })
    )
      .then(() =>
        request(
          test.bind(null, {
            contentLength: 11,
            body: 'POST + POST'
          }),
          { method: 'POST' }
        )
      )
      .then(() => {
        server.close();
        done();
      });
  });
};
