/* eslint no-console: 0 */

const rayo = require('../../packages/rayo');

rayo({ port: 5050, storm: {} })
  .get('/', (req, res) => res.end('Thunderstruck storm'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
