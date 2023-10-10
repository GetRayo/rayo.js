/* eslint import/extensions: 0 */

import { storm } from '@rayo/storm';

const [, , workers] = process.argv;
storm(() => {}, {
  keepAlive: false,
  workers,
  master() {
    this.on('worker', () => {
      this.stop();
    });
  }
});
