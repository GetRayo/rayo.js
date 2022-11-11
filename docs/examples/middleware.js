/* eslint import/extensions: 0 */
/* eslint no-console: 0 */

import rayo from '../../packages/rayo/index.js';
import send from '../../packages/send/index.js';

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
