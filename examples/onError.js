/* eslint no-console: 0 */

const rayo = require('../bin');

const options = {
  port: 5050,
  onError: (error, req, res) => {
    res.end(`Here's your error; ${error}`);
  }
};

/**
 * Start Rayo (`node notFound.js`) and visit '/',
 * you will get the above response.
 */
rayo(options)
  .get('/', (req, res, step) => step('Thunderstruck'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
