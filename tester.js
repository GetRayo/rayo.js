const rayo = require('./bin/rayo');

const server = rayo({ port: 5050 });

/**
 * Bridge the `/home` path to the `GET` and `HEAD` verbs.
 */
server
  .bridge('/home')
  .get((req, res) => res.end('You are home, GET'))
  .head((req, res) => res.end('You are home, HEAD'));

/**
 * Bridge the `/game` path to the `POST` and `PUT` verbs.
 */
server
  .bridge('/game')
  .get((req, res) => res.end('You are at the game, POST'))
  .put((req, res) => res.end('You are at the game, PUT'));

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
 * and through two handlers.
 */
server
  .bridge('/account')
  .through(auth, session)
  .get((req, res) => res.end('You are at the account, GET'))
  .post((req, res) => res.end('You are at the account, POST'))
  .put((req, res) => res.end('You are at the account, PUT'));

server.start();
