/* eslint no-console: 0 */

const https = require('https');
const { readFileSync } = require('fs');
const rayo = require('../../packages/rayo');

const server = https.createServer({
  key: readFileSync(`${__dirname}/localhost.key`),
  cert: readFileSync(`${__dirname}/localhost.crt`)
});

rayo({ port: 5050, server })
  .get('/', (req, res) => res.end('Thunderstruck (HTTPS)'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
