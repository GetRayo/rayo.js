const should = require('should');
const { METHODS } = require('http');
const Bridge = require('../../packages/rayo/bridge');

const test = (bridge, path = null) => {
  should(bridge).be.an.Object();
  should(bridge).have.properties(
    'id',
    'bridgedPath',
    'routes',
    'through',
    'route',
    'fetch'
  );
  should(bridge.id).be.a.String();
  should(bridge.bridgedPath).be.equal(path);
  should(bridge.routes).be.an.Object();
  should(bridge.through).be.a.Function();
  should(bridge.route).be.a.Function();
  should(bridge.fetch).be.a.Function();
  METHODS.forEach((method) => {
    should(bridge).have.property(method.toLowerCase());
  });

  if (path) {
    should(bridge.bridgedPath).be.a.String();
  }
};

module.exports = () => {
  it('Without path', (done) => {
    test(new Bridge());
    done();
  });

  it('Without path, through', (done) => {
    test(new Bridge().through(() => {}, () => {}).through());
    done();
  });

  it('With path', (done) => {
    test(new Bridge('/path'), '/path');
    done();
  });

  it('With path, through', (done) => {
    test(new Bridge('/path').through(() => {}, () => {}).through(), '/path');
    done();
  });

  it('Sub-bridge, without path', (done) => {
    test(new Bridge().bridge());
    done();
  });

  it('Sub-bridge, without path, through', (done) => {
    test(
      new Bridge()
        .bridge()
        .through(() => {}, () => {})
        .through()
    );
    done();
  });

  it('Sub-bridge, with path', (done) => {
    test(new Bridge().bridge('/path'), '/path');
    done();
  });

  it('Sub-bridge, with path, through', (done) => {
    test(
      new Bridge()
        .bridge('/path')
        .through(() => {}, () => {})
        .through(),
      '/path'
    );
    done();
  });

  it('Route all', (done) => {
    test(new Bridge().all('/path', () => {}));
    done();
  });
};
