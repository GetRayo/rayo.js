/* eslint no-console: 0 */

const rayo = require('../bin/rayo');

rayo.get('/home', (req, res) => {
  res.send({ fixed: 'home' });
});

rayo.get('/', (req, res) => {
  res.end(JSON.stringify({ hello: 'world' }));
});

rayo.route('GET', '/:endpoint/:id/:action', (req, res) => {
  res.send(req.params);
});

rayo.route(
  'GET',
  '/:endpoint/:id?',
  (req, res, next) => {
    console.log('Going to next...');
    next();
  },
  (req, res) => {
    res.send({ params: req.params });
  }
);

rayo.start({ port: 9000 }, () => {
  console.log('Up!');
});
