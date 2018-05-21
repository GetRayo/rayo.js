/* eslint no-console: 0 */

const rayo = require('../bin/rayo');

const middlewareOne = (req, res, step) => {
  req.age = req.params.age;
  step();
};

const middlewareTwo = (req, res, step) => {
  req.age /= 1.25;
  step();
};

rayo({ port: 9000 })
  .on('/home')
  .get((req, res) => res.send({ less: true }))
  .post((req, res) => res.send({ less: true }))
  .delete((req, res) => res.send({ less: true }))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
