/* eslint import/extensions: 0 */
/* eslint no-console: 0 */

import rayo from '../../packages/rayo/index.js';
import compress from '../../packages/compress/index.js';
import send from '../../packages/send/index.js';

rayo({ port: 8080 })
  .through(compress({ chunkSize: 1024 }), send())
  .get('/', (req, res) => {
    res.setHeader('content-type', 'text/plain');
    res.write('Hello! ');
    res.end(
      `Morbi libero felis, rutrum quis nisl porttitor, pharetra scelerisque nulla.
      Nullam at dolor lectus. Cras ullamcorper tellus ut ante congue luctus.
      Nam in congue mauris. Vestibulum rutrum luctus quam.
      Morbi diam justo, feugiat at sodales quis, dapibus sit amet quam.
      Nulla et ex consequat, dapibus turpis vitae, accumsan diam.
      Vivamus tempus posuere orci et molestie.
      Suspendisse varius, sem ut sollicitudin egestas, mi mauris condimentum diam, eu dapibus turpis erat ac lacus.
      Curabitur non pharetra arcu. In cursus augue euismod enim finibus, in maximus mi efficitur.
      Duis nunc lacus, malesuada ac ultricies et, sodales ac dui.
      Mauris ullamcorper egestas ligula, nec faucibus purus aliquet sit amet.
      Quisque ultrices in lorem nec efficitur.`
    );
  })
  .start(({ port, workerPid }) => {
    console.log(`Up on port ${port} | PID: ${workerPid}`);
  });
