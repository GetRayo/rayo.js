/* eslint no-console: 0 */

const rayo = require('../../bin');

const middlewareOne = (req, res, step) => {
  req.age = req.params.age;
  console.log('MW ONE');
  step();
};

const middlewareTwo = (req, res, step) => {
  req.age /= 1.25;
  req.params.noches *= 2;
  console.log('MW TWO');
  step();
};

const middlewareThree = (req, res, step) => {
  req.name = `Great ${req.params.name.toUpperCase()}`;
  step();
};

const middlewareFour = (req, res) => {
  res.send({ name: req.name, age: req.age, dias: req.params.dias, noches: req.params.noches });
};

const ray = rayo({
  port: 9000,
  notFound: (req, res) => res.end('NONO'),
  onError: (error, req, res) => res.end(error)
}).through(middlewareOne, middlewareTwo, middlewareThree, middlewareFour);

ray
  .bridge('/err')
  .through((req, res, step) => {
    console.log('UNO');
    step();
  })
  .all((req, res) => {
    console.log('DOS');
    res.end('dddd');
  });

const y = ray.bridge('/lol');
y
  .through((req, res, step) => {
    console.log('UNO');
    step();
  })
  .get((req, res) => {
    console.log('DOSaaaa');
    res.end('LOL 1');
  });

y.route('GET', '/pelo', (r, q) => {
  console.log('DXXXXX');
  q.send('PELO');
});

y.all((req, res) => {
  console.log('TRES');
  res.end('LOL 2');
});

// console.log(x.mw.GET['/err']);

ray.start((address) => {
  console.log(`Up on port ${address.port}`);
});

/*

ray
  .bridge('/nada')
  .all((req, res, step) => step('d'));

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
 */
