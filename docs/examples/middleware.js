/* eslint no-console: 0 */

const rayo = require('../../packages/rayo');
const send = require('../../packages/send');

const options = {
  port: 5050,
  onError: (error, req, res) => res.send({ error }, 409),
  notFound: (req, res) => res.send({ error: `${req.url} not found` }, 404)
};

rayo(options)
  .through(send())
  .get('/', (req, res, step) => step('Thrown by the step function...'))
  .start((address) => {
    console.log(`Up on port ${address.port}`);
  });
