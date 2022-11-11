import http from 'http';
import should from 'should';
import rayo from '../packages/rayo/index.js';
import send from '../packages/send/index.js';

const request = (resolver, options = {}) => {
  return new Promise((yes) => {
    options.port = options.port || 5050;
    options.path = options.path || '/';
    options.method = options.method || 'GET';

    const req = http.request(options, (res) => {
      res.on('data', resolver.bind(null, res.headers, res.statusCode));
      res.on('end', yes);
    });

    req.end();
  });
};
const test = (options = {}, headers, status, body) => {
  options.statusCode = options.statusCode || 200;
  options.headers = options.headers || 'text/plain; charset=utf-8';

  if (headers['content-type']) {
    should(headers['content-type']).be.a.String();
    should(headers['content-type']).be.equal(options.headers);
  }

  should(parseInt(headers['content-length'], 10)).be.equal(options.contentLength);
  should(status).be.a.Number();
  should(status).be.equal(options.statusCode);
  should(body.toString()).be.equal(options.body);
};

let server = null;
export default function integrationTest() {
  beforeEach(() => {
    server = rayo({ port: 5050, cluster: false });
  });
  afterEach(() => {
    server = null;
  });

  it('GET request', (done) => {
    server = server.get('/', (req, res) => res.end('Thunderstruck!')).start();
    request(test.bind(null, { contentLength: 14, body: 'Thunderstruck!' })).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, with middleware', (done) => {
    server = server
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
    server = server
      .through(send())
      .get('/', (req, res) => res.send('Thunderstruck!'))
      .start();

    request(test.bind(null, { contentLength: 14, body: 'Thunderstruck!' })).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(text/html)', (done) => {
    server = server
      .through(send())
      .get('/', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send('Thunderstruck!');
      })
      .start();

    request(
      test.bind(null, {
        contentLength: 14,
        headers: 'text/html; charset=UTF-8',
        body: 'Thunderstruck!'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(text/html), status code', (done) => {
    server = server
      .through(send())
      .get('/', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send('Thunderstruck!', 202);
      })
      .start();

    request(
      test.bind(null, {
        contentLength: 14,
        statusCode: 202,
        headers: 'text/html; charset=UTF-8',
        body: 'Thunderstruck!'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(text/plain), status code', (done) => {
    server = server
      .through(send())
      .get('/', (req, res) => res.send('Thunderstruck!', 202))
      .start();

    request(
      test.bind(null, {
        contentLength: 14,
        statusCode: 202,
        body: 'Thunderstruck!'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(application/json)', (done) => {
    server = server
      .through(send())
      .get('/', (req, res) => res.send({ message: 'Thunderstruck!' }))
      .start();

    request(
      test.bind(null, {
        contentLength: 28,
        headers: 'application/json; charset=utf-8',
        body: '{"message":"Thunderstruck!"}'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('GET request, send(application/json), status code', (done) => {
    server = server
      .through(send())
      .get('/', (req, res) => res.send({ message: 'Thunderstruck!' }, 202))
      .start();

    request(
      test.bind(null, {
        contentLength: 28,
        headers: 'application/json; charset=utf-8',
        statusCode: 202,
        body: '{"message":"Thunderstruck!"}'
      })
    ).then(() => {
      server.close();
      done();
    });
  });

  it('Bridged GET, POST request', (done) => {
    server
      .bridge('/')
      .get((req, res) => res.end('GET'))
      .post((req, res) => res.end('POST'));

    server = server.start();
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
    server
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

    server = server.start();
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
}
