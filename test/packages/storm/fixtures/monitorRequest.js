/* eslint import/extensions: 0 */

import helpers from '../../../utils/helpers.mjs';
import { storm } from '../../../../packages/storm/index.js';

const [, , workers, workerId, , service] = process.argv;
storm(() => {}, {
  keepAlive: false,
  monitor: true,
  monitorPort: 65000,
  workers,
  master() {
    this.on('worker', () => {
      setTimeout(async () => {
        const data = await helpers.request({
          host: 'localhost',
          port: 65000,
          path: `/${service}/${workerId}`
        });

        process.stdout.write(data);
        this.stop();
      }, 200);
    });
  }
});
