const should = require('should');
const sinon = require('sinon');
const response = require('../../bin/response');

const fake = {
  req: require.call(null, '../utils/req'),
  res: require.call(null, '../utils/res')
};

let sandbox;
module.exports = () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('Response', (done) => {
    setTimeout(() => {
      should(response).be.an.Object();
      should(response).have.properties('send');

      done();
    }, 25);
  });

  it('send, (without payload, without status code)', (done) => {
    sandbox.stub(fake.res, 'writeHead').callsFake((statusCode, payload) => {
      should(statusCode).be.a.Number();
      should(statusCode).be.equal(200);
      should(payload).be.an.Object();
      should(payload).have.properties('Content-Type');
      should(payload['Content-Type']).be.a.String();
      should(payload['Content-Type']).be.equal('text/plain');
    });
    sandbox.stub(fake.res, 'write').callsFake((payload) => {
      should(payload).be.equal(undefined);
    });

    const send = response.send.bind(fake.res);

    setTimeout(() => {
      send();
      done();
    }, 25);
  });

  it('send, (with plain payload, without status code)', (done) => {
    sandbox.stub(fake.res, 'write').callsFake((payload) => {
      should(payload).be.a.String();
      should(payload).be.equal('Test payload');
    });

    const send = response.send.bind(fake.res);

    setTimeout(() => {
      send('Test payload');
      done();
    }, 25);
  });

  it('send, (with plain payload, with status code)', (done) => {
    sandbox.stub(fake.res, 'writeHead').callsFake((statusCode) => {
      should(statusCode).be.a.Number();
      should(statusCode).be.equal(204);
    });
    sandbox.stub(fake.res, 'write').callsFake((payload) => {
      should(payload).be.a.String();
      should(payload).be.equal('Test payload');
    });

    const send = response.send.bind(fake.res);

    setTimeout(() => {
      send('Test payload', 204);
      done();
    }, 25);
  });

  it('send, (with .json payload, with status code)', (done) => {
    sandbox.stub(fake.res, 'writeHead').callsFake((statusCode, payload) => {
      should(statusCode).be.a.Number();
      should(statusCode).be.equal(204);
      should(payload['Content-Type']).be.equal('application/json');
    });
    sandbox.stub(fake.res, 'write').callsFake((payload) => {
      should(payload).be.a.String();
      should(payload).be.equal('{"id":1000,"message":"Test payload"}');

      const parsedResponse = JSON.parse(payload);
      should(parsedResponse).be.an.Object();
      should(parsedResponse).have.properties('id', 'message');
      should(parsedResponse.id).be.a.Number();
      should(parsedResponse.id).be.equal(1000);
      should(parsedResponse.message).be.a.String();
      should(parsedResponse.message).be.equal('Test payload');
    });

    const send = response.send.bind(fake.res);

    setTimeout(() => {
      send({ id: 1000, message: 'Test payload' }, 204);
      done();
    }, 25);
  });
};
