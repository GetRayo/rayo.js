import { cpus } from 'os';
// eslint-disable-next-line import/extensions
import { storm } from '../../../../packages/storm/index.js';

const workers = parseInt(process.argv[2], 10);
let loaded = 0;
storm(() => {}, {
  keepAlive: false,
  monitor: false,
  workers,
  master() {
    this.on('worker', () => {
      loaded += 1;
      if (loaded === (workers || cpus().length)) {
        this.stop();
      }
    });
  }
});
