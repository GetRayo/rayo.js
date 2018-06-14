const should = require('should');
const sinon = require('sinon');
const request = require('supertest');
const send = require('../../../packages/plugins/send');
const { header, wrap } = require('../../utils/helpers');

let sandbox;
module.exports = () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('send', (done) => {
    should(send()).be.a.Function();
    done();
  });

  it('send, without payload, without status code', (done) => {
    request(wrap(send, (req, res) => res.send()))
      .get('/')
      .expect(header('content-type', 'text/plain'))
      .expect(200, '', done);
  });

  it('send, text', (done) => {
    request(wrap(send, (req, res) => res.send('Thunderstruck!')))
      .get('/')
      .expect(header('content-type', 'text/plain'))
      .expect(header('content-length', '14'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('send, text and status', (done) => {
    request(wrap(send, (req, res) => res.send('Thunderstruck!', 404)))
      .get('/')
      .expect(header('content-type', 'text/plain'))
      .expect(header('content-length', '14'))
      .expect(404, 'Thunderstruck!', done);
  });

  it('send, json', (done) => {
    request(wrap(send, (req, res) => res.send({ status: 'Thunderstruck!' })))
      .get('/')
      .expect(header('content-type', 'application/json'))
      .expect(200, '{"status":"Thunderstruck!"}', done);
  });

  it('send, json and status', (done) => {
    request(wrap(send, (req, res) => res.send({ status: 'Thunderstruck!' }, 404)))
      .get('/')
      .expect(header('content-type', 'application/json'))
      .expect(404, '{"status":"Thunderstruck!"}', done);
  });

  it('send, json (large)', (done) => {
    const json = require.call(null, '../../utils/sample.json');
    request(wrap(send, (req, res) => res.send(json)))
      .get('/')
      .expect(header('content-type', 'application/json'))
      .expect(200, done);
  });

  it('send, json (large) and status', (done) => {
    const json = require.call(null, '../../utils/sample.json');
    request(wrap(send, (req, res) => res.send(json, 404)))
      .get('/')
      .expect(header('content-type', 'application/json'))
      .expect(404, done);
  });
};
