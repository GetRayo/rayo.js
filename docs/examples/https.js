/* eslint import/extensions: 0 */
/* eslint no-console: 0 */

import https from 'https';
import { readFileSync } from 'fs';
import rayo from '../../packages/rayo/index.js';

const server = https.createServer({
  key: readFileSync(`${__dirname}/localhost.key`),
  cert: readFileSync(`${__dirname}/localhost.crt`)
});

rayo({ port: 5050, server })
  .get('/', (req, res) => res.end('Thunderstruck (HTTPS)'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
