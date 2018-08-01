/* eslint no-console: 0 */

const rayo = require('../rayo');

rayo({ port: 5050 })
  .get('/', (req, res) => res.end('Thunderstruck..!'))
  .post('/', (req, res) => {
    const contentType = req.headers['content-type'];
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log(JSON.parse(body));
      res.end('Thunderstruck..!');
    });
  })
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
