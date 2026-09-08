/* eslint no-console: 0 */

import https from 'https';
import { readFileSync } from 'fs';
import rayo from 'rayo';

// From the repository root, generate certificates with:
// (cd docs/examples && bash certs.sh)
const server = https.createServer({
  key: readFileSync(new URL('./localhost.key', import.meta.url)),
  cert: readFileSync(new URL('./localhost.crt', import.meta.url))
});

rayo({ port: 5050, server })
  .get('/', (req, res) => res.end('Thunderstruck (HTTPS)'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
