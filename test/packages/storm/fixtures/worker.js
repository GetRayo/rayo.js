/* eslint import/extensions: 0 */

import { cpus } from 'os';
import { storm } from '@rayo/storm/index.js';

const [, , workers, , , , keepAsString] = process.argv;
const toLoad = keepAsString === 'yes' ? cpus().length : parseInt(workers, 10);

let loaded = 0;
storm(() => {}, {
  keepAlive: false,
  monitor: false,
  workers: keepAsString === 'yes' ? workers : toLoad,
  master() {
    this.on('worker', () => {
      loaded += 1;
      if (loaded === toLoad) {
        this.stop();
      }
    });
  }
});
