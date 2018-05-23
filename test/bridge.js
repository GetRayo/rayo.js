/* eslint no-console: 0 */

const rayo = require('../bin/rayo');

const middlewareOne = (req, res, step) => {
  req.age = req.params.age;
  step();
};

const middlewareTwo = (req, res, step) => {
  req.age /= 1.25;
  req.params.noches *= 2;
  step();
};

const middlewareThree = (req, res, step) => {
  req.name = `Great ${req.params.name.toUpperCase()}`;
  step();
};

const middlewareFour = (req, res) => {
  res.send({ name: req.name, age: req.age, dias: req.params.dias, noches: req.params.noches });
};

const ray = rayo({ port: 9000 });

ray
  .bridge('/nada')
  .all((req, res) => res.end('Nada'));

// console.log(a);

//  .get(middlewareOne, middlewareTwo, middlewareFour)
//  .post(middlewareOne, middlewareTwo, middlewareFour);


ray.bridge('/noche/:noches').get(middlewareOne, middlewareTwo, middlewareFour);

ray
  .through(middlewareOne, middlewareTwo)
  .all('/r', (req, res) => res.end('All on R'))
  .get('/', (req, res) => res.end('Thunderstruck'))
  .get('/hello/:name/:age', middlewareThree, middlewareFour)
  .route('GET', '/more', (req, res) => {
    res.send({ more: true });
  })
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
