/* eslint no-console: 0 */

const rayo = require('../bin');

/**
 * Setup a path ('/') on the specified HTTP verbs.
 * @see https://nodejs.org/api/http.html#http_http_methods
 */
rayo({ port: 5050 })
  .get('/', (req, res, step) => step('Thunderstruck (GET)'))
  .post('/', (req, res, step) => step('Thunderstruck (POST)'))
  .put('/', (req, res, step) => step('Thunderstruck (PUT)'))
  .delete('/', (req, res, step) => step('Thunderstruck (DELETE)'))
  .head('/', (req, res, step) => step('Thunderstruck (HEAD)'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
