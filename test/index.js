/* eslint no-console: 0 */

const rayo = require('../bin/rayo');

const middlewareOne = (req, res, next) => {
  console.log('ONE');
  next();
};

const middlewareTwo = (req, res, next) => {
  console.log('TWO');
  next();
};

const middlewareThree = (req, res) => {
  res.end(JSON.stringify({ hello: 'world' }));
};

rayo({ port: 9000 })
  .through(middlewareOne, middlewareTwo)
  .get('/', middlewareThree)
  .start(() => {
    console.log('Up!');
  });

// router.route('/on').get(middlewareThree);
// router.route('/off').through(middlewareOne, middlewareTwo).get(middlewareThree);
