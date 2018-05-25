/* eslint no-console: 0 */

const rayo = require('../bin');

/**
 * Setup a path ('/') on any HTTP verb.
 * @see https://nodejs.org/api/http.html#http_http_methods
 */
rayo({ port: 5050 })
  .all('/', (req, res, step) => step('Thunderstruck (Any HTTP verb)'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
