/* eslint import/extensions: 0 */
/* eslint no-console: 0 */

import rayo from '../../packages/rayo/index.js';

rayo({ port: 5050, storm: {} })
  .get('/', (req, res) => res.end('Thunderstruck storm'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
