import { cpus } from 'os';
// eslint-disable-next-line import/extensions
import { storm } from '../../../../packages/storm/index.js';

const workers = parseInt(process.argv[2], 10);
let loaded = 0;
storm(() => process.exit(), {
  monitor: false,
  workers: parseInt(process.argv[2], 10),
  master() {
    this.on('worker', () => {
      loaded += 1;
      if (loaded === (workers || cpus().length)) {
        setTimeout(this.stop, 500);
      }
    });
  }
});
