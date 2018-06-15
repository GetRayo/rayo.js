const should = require('should');
const sinon = require('sinon');
const { METHODS } = require('http');
const rayo = require('../../packages/rayo');

const fake = {
  req: require.call(null, '../utils/req'),
  res: require.call(null, '../utils/res')
};

const test = (server) => {
  should(server).be.an.Object();
  should(server).have.properties('server', 'dispatch', 'start', 'step');
  should(server.server).be.an.Object();
  should(server.dispatch).be.an.Function();
  should(server.start).be.an.Function();
  should(server.step).be.an.Function();
  METHODS.forEach((method) => {
    should(server[method.toLowerCase()]).be.a.Function();
  });
};

let sandbox;
module.exports = () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('Rayo', (done) => {
    test(rayo());
    done();
  });

  it('Start (without callback)', (done) => {
    const server = rayo({ port: 5050 });
    const httpServer = server.start();

    setTimeout(() => {
      test(server);
      should(httpServer).be.an.Object();
      httpServer.close();

      done();
    }, 25);
  });

  it('Start (with callback)', (done) => {
    const server = rayo({ port: 5050 });
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
    const server = rayo({ port: 5050 }).get('/', () => {});
    const stack = server.dispatch(fake.req, fake.res);

    setTimeout(() => {
      test(server);
      should(stack).equal(undefined);
      done();
    }, 25);
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

    const server = rayo({ port: 5050 }).post('/', () => {});
    const stack = server.dispatch(fake.req, fake.res);

    setTimeout(() => {
      test(server);
      should(stack).equal(undefined);
      done();
    }, 25);
  });

  it('Dispatch (custom notFound function)', (done) => {
    const server = rayo({
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
    const server = rayo({
      port: 5050
    }).post('/', () => {});

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
    const server = rayo({
      port: 5050
    }).post('/', () => {});

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

    const server = rayo({
      port: 5050
    }).post('/', () => {});

    setTimeout(() => {
      test(server);
      server.step(fake.req, fake.res, [], 'The error.');
      done();
    }, 25);
  });

  it('step (with error and custom onError)', (done) => {
    const server = rayo({
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
