// eslint-disable-next-line import/extensions
import { storm } from '../../../../packages/storm/index.js';

const workers = parseInt(process.argv[2], 10);
storm(() => {}, {
  monitor: false,
  workers,
  master() {
    this.on('worker', () => {
      this.stop();
    });
  }
});
