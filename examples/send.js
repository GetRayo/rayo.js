/* eslint no-console: 0 */

const rayo = require('../bin');

rayo({ port: 5050 })
  .get('/', (req, res) => {
    res.send({
      message: 'I am more complex, .json, reply.',
      method: req.method,
      timestamp: +new Date()
    });
  })
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
