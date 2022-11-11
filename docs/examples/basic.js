/* eslint import/extensions: 0 */
/* eslint no-console: 0 */

import rayo from '../../packages/rayo/index.js';
import compress from '../../packages/compress/index.js';
import send from '../../packages/send/index.js';

rayo({
  port: 8080,
  storm: {
    workers: 4,
    monitor: true,
    monitorPort: 65000
  }
})
  .through(compress(), send())
  .get('/', (req, res) => {
    res.send({
      message: 'Hello',
      worker: process.pid
    });
  })
  .start(({ port, workerPid }) => {
    console.log(`Up on port ${port} | PID: ${workerPid}`);
  });
