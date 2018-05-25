/* eslint no-console: 0 */

const rayo = require('../bin');

const options = {
  port: 5050,
  notFound: (req, res) => {
    res.end('The requested page is magically gone.');
  }
};

/**
 * Start Rayo (`node notFound.js`) and visit any URL other than '/',
 * you will get the above response.
 */
rayo(options)
  .get('/', (req, res) => res.end('Thunderstruck'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
