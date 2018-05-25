/* eslint no-console: 0 */

const rayo = require('../bin');

const server = rayo({ port: 5050 });

/**
 * Bridge the `/home` path to the `GET` and `HEAD` verbs.
 */
server
  .bridge('/home')
  .get((req, res) => {
    res.end('You are home!');
  })
  .head((req, res) => {
    res.end('You are home!');
  });

/**
 * Bridge the `/game` path to the `POST` and `PUT` verbs.
 */
server
  .bridge('/game')
  .post((req, res) => {
    res.end('You are home!');
  })
  .put((req, res) => {
    res.end('You are home!');
  });

const auth = (req, res, step) => {
  req.isAuthenticated = true;
  step();
};

const session = (req, res, step) => {
  req.hasSession = true;
  step();
};

/**
 * Bridge the `/account` path to the `GET`, `POST` and `PUT` verbs
 * through two handlers.
 */
server
  .bridge('/account')
  .through(auth, session)
  .get((req, res) => {
    res.end('This is your account.');
  })
  .post((req, res) => {
    res.end('This is your account.');
  })
  .put((req, res) => {
    res.end('This is your account.');
  });

server.start((address) => {
  console.log(`Up on port ${address.port}`);
});
