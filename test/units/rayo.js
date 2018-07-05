const should = require('should');
const sinon = require('sinon');
const { METHODS } = require('http');
const storm = require('../../packages/storm');
const rayo = require('../../packages/rayo');

const fake = {
  req: require.call(null, '../utils/req'),
  res: require.call(null, '../utils/res')
};

const test = (server) => {
  should(server).be.an.Object();
  should(server).have.properties('server', 'dispatch', 'start', 'step');
  if (server.server) {
    should(server.server).be.an.Object();
  }
  should(server.dispatch).be.an.Function();
  should(server.start).be.an.Function();
  should(server.step).be.an.Function();
  METHODS.forEach((method) => {
    should(server[method.toLowerCase()]).be.a.Function();
  });
};

let sandbox;
let server = null;
module.exports = () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    server = rayo({ port: 5050 });
  });

  afterEach(() => {
    sandbox.restore();
    server = null;
  });

  it('Rayo', (done) => {
    test(rayo());
    done();
  });

  it('Rayo, with storm', (done) => {
    server = rayo({
      port: 5050,
      storm: {
        workers: 2
      }
    }).get('/', () => {});

    sinon.stub(storm.Storm.prototype, 'start').callsFake(() => ({ cluster: 'ok' }));
    const httpServer = server.start();
    setTimeout(() => {
      if (httpServer) {
        should(httpServer).be.an.Object();
        httpServer.close();
        process.exit();
      }

      done();
    }, 250);
  });

  it('Start (without callback)', (done) => {
    const httpServer = server.start();

    setTimeout(() => {
      test(server);
      should(httpServer).be.an.Object();
      httpServer.close();

      done();
    }, 25);
  });

  it('Start (with callback)', (done) => {
    const httpServer = server.start((info) => {
      should(info.port).be.a.Number();
      should(info.port).be.equal(5050);
    });

    setTimeout(() => {
      test(server);
      should(httpServer).be.an.Object();
      httpServer.close();
      done();
    }, 25);
  });

  it('Dispatch (defined verb)', (done) => {
    server.get('/', () => {});
    server.dispatch(fake.req, fake.res).then((stack) => {
      setTimeout(() => {
        test(server);
        should(stack).equal(undefined);
        done();
      }, 25);
    });
  });

  it('Dispatch (undefined verb)', (done) => {
    sandbox.stub(fake.res, 'writeHead').callsFake((status, headers) => {
      should(status).be.a.Number();
      should(status).be.equal(404);
      should(headers).be.an.Object();
      should(headers).have.property('Content-Type');
      should(headers['Content-Type']).be.a.String();
      should(headers['Content-Type']).be.equal('text/plain');
    });
    sandbox.stub(fake.res, 'write').callsFake((response) => {
      should(response).be.a.String();
      should(response).be.equal('Page not found.');
    });

    server.post('/', () => {});
    server.dispatch(fake.req, fake.res).then((stack) => {
      setTimeout(() => {
        test(server);
        should(stack).equal(undefined);
        done();
      }, 25);
    });
  });

  it('Dispatch (custom notFound function)', (done) => {
    server = rayo({
      port: 5050,
      notFound: (req) => {
        should(req.method).be.a.String();
        should(req.method).be.equal('GET');
      }
    }).post('/', () => {});
    server.dispatch(fake.req, fake.res);

    setTimeout(() => {
      test(server);
      done();
    }, 25);
  });

  it('step (without stack)', (done) => {
    server.post('/', () => {});
    setTimeout(() => {
      test(server);
      try {
        server.step(fake.req, fake.res, []);
      } catch (error) {
        should(error).be.an.Object();
        should(error.message).be.a.String();
        should(error.message).be.equal('No handler to move to, the stack is empty.');

        done();
      }
    }, 25);
  });

  it('step (with stack)', (done) => {
    server.post('/', () => {});
    setTimeout(() => {
      test(server);
      const nextStackFunction = server.step(fake.req, fake.res, [
        () => 'Returned stack function.'
      ]);
      should(nextStackFunction).be.a.String();
      should(nextStackFunction).be.equal('Returned stack function.');

      done();
    }, 25);
  });

  it('step (with error)', (done) => {
    sandbox.stub(fake.res, 'writeHead').callsFake((status, headers) => {
      should(status).be.a.Number();
      should(status).be.equal(400);
      should(headers).be.an.Object();
      should(headers).have.property('Content-Type');
      should(headers['Content-Type']).be.a.String();
      should(headers['Content-Type']).be.equal('text/plain');
    });
    sandbox.stub(fake.res, 'write').callsFake((response) => {
      should(response).be.a.String();
      should(response).be.equal('The error.');
    });

    server.post('/', () => {});
    setTimeout(() => {
      test(server);
      server.step(fake.req, fake.res, [], 'The error.');
      done();
    }, 25);
  });

  it('step (with error and custom onError)', (done) => {
    server = rayo({
      port: 5050,
      onError: (error) => {
        should(error).be.a.String();
        should(error).be.equal('The error.');
      }
    }).post('/', () => {});

    setTimeout(() => {
      test(server);
      server.step(fake.req, fake.res, [], 'The error.');
      done();
    }, 25);
  });
};
