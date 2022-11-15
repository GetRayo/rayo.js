/* eslint import/extensions: 0 */

import { readFileSync } from 'fs';
import should from 'should';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';
import send from '../../../packages/send/index.js';
import helpers from '../../utils/helpers.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sampleJSON = readFileSync(path.join(directory, '../../samples/data.json'), 'utf8');

export default function sendTest() {
  it('send', (done) => {
    should(send()).be.a.Function();
    done();
  });

  it('send, without payload, without status code', (done) => {
    request(helpers.wrap(send, (req, res) => res.send()))
      .get('/')
      .expect(helpers.header('content-type', 'text/plain; charset=utf-8'))
      .expect(200, '', done);
  });

  it('send, text', (done) => {
    request(helpers.wrap(send, (req, res) => res.send('Thunderstruck!')))
      .get('/')
      .expect(helpers.header('content-type', 'text/plain; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('send, text and status', (done) => {
    request(helpers.wrap(send, (req, res) => res.send('Thunderstruck!', 404)))
      .get('/')
      .expect(helpers.header('content-type', 'text/plain; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(404, 'Thunderstruck!', done);
  });

  it('send, html', (done) => {
    request(
      helpers.wrap(send, (req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.send('Thunderstruck!');
      })
    )
      .get('/')
      .expect(helpers.header('content-type', 'text/html; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(200, 'Thunderstruck!', done);
  });

  it('send, html and status', (done) => {
    request(
      helpers.wrap(send, (req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.send('Thunderstruck!', 404);
      })
    )
      .get('/')
      .expect(helpers.header('content-type', 'text/html; charset=utf-8'))
      .expect(helpers.header('content-length', '14'))
      .expect(404, 'Thunderstruck!', done);
  });

  it('send, json', (done) => {
    request(helpers.wrap(send, (req, res) => res.send({ status: 'Thunderstruck!' })))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(200, '{"status":"Thunderstruck!"}', done);
  });

  it('send, json and status', (done) => {
    request(helpers.wrap(send, (req, res) => res.send({ status: 'Thunderstruck!' }, 404)))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(404, '{"status":"Thunderstruck!"}', done);
  });

  it('send, json (large)', (done) => {
    request(helpers.wrap(send, (req, res) => res.send(sampleJSON)))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(200, done);
  });

  it('send, json (large) and status', (done) => {
    request(helpers.wrap(send, (req, res) => res.send(sampleJSON, 404)))
      .get('/')
      .expect(helpers.header('content-type', 'application/json; charset=utf-8'))
      .expect(404, done);
  });
}
