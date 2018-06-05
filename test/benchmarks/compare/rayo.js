const rayo = require('../../../packages/rayo/lib');

rayo({ port: 5050 })
  .get('/', (req, res) => res.end('Thunderstruck...'))
  .start();
