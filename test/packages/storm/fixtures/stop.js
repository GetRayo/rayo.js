/* eslint import/extensions: 0 */

import { storm } from '@rayo/storm/index.js';

const [, , workers] = process.argv;
storm(() => {}, {
  monitor: false,
  workers,
  master() {
    this.on('worker', () => {
      this.stop();
    });
  }
});
