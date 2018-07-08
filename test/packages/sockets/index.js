const should = require('should');
const sinon = require('sinon');
const request = require('supertest');
const sockets = require('../../../packages/sockets');
const { header, wrap } = require('../../utils/helpers');

let sandbox;
module.exports = () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('socket', (done) => {
    should(sockets()).be.a.Function();
    done();
  });
};
