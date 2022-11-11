/* eslint import/extensions: 0 */

import { storm } from '../../../../packages/storm/index.js';

const [, , workers] = process.argv;
const toLoad = parseInt(workers, 10);

let loaded = 0;
storm(() => process.exit(), {
  monitor: false,
  workers: toLoad,
  master() {
    this.on('worker', () => {
      loaded += 1;
      if (loaded === toLoad) {
        setTimeout(this.stop, 250);
      }
    });
  }
});
