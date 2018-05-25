/* eslint no-console: 0 */

const rayo = require('../bin');

// "age" handler
const age = (req, res, step) => {
  req.age = 21;
  step();
};

// "name" handler
const name = (req, res, step) => {
  req.name = 'Rayo';
  step();
};

rayo({ port: 5050 })
  .through(age, name)
  .get('/', (req, res) => res.end(`Thunderstruck | ${req.age} | ${req.name}`))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
