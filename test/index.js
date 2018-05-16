/* eslint no-console: 0 */

const rayo = require('../bin/rayo');

const middlewareOne = (req, res, step) => {
  req.test = 10;
  step();
};

const middlewareTwo = (req, res, step) => {
  req.test *= 3;
  step();
};

const middlewareThree = (req, res) => {
  res.send({ hello: req.params.friend, test: req.test });
};

rayo({ port: 9000 })
  .through(middlewareOne, middlewareTwo)
  .get('/hello/:friend', middlewareThree)
  .start(() => {
    console.log('Up!');
  });

// router.route('/on').get(middlewareThree);
// router.route('/off').through(middlewareOne, middlewareTwo).get(middlewareThree);
