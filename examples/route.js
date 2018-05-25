/* eslint no-console: 0 */

const rayo = require('../bin');

rayo({ port: 5050 })
  .route('GET', '/', (req, res) => res.end(`Thunderstruck | GET | route`))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
