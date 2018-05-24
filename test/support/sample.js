/* eslint no-console: 0 */

const rayo = require('../../bin/rayo');

const middlewareOne = (req, res, step) => {
  req.age = req.params.age;
  step();
};

const middlewareTwo = (req, res, step) => {
  req.age /= 1.25;
  step();
};

const middlewareThree = (req, res, step) => {
  req.name = `Great ${req.params.name.toUpperCase()}`;
  step();
};

const middlewareFour = (req, res) => {
  res.send({ name: req.name, age: req.age });
};

rayo({ port: 9000 })
  .through(middlewareOne, middlewareTwo)
  .get('/', (req, res) => res.end('Thunderstruck'))
  .get('/hello/:name/:age', middlewareThree, middlewareFour)
  .route('GET', '/more', (req, res) => {
    res.send({ more: true });
  })
  .route(['GET', 'POST', 'DELETE'], '/less', (req, res) => {
    res.send({ less: true });
  })
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
