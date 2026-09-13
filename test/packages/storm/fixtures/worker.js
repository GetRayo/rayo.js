import { availableParallelism } from 'node:os';
import { storm } from '@rayo/storm';

const [, , workers, , , , keepAsString] = process.argv;
const toLoad = Number(workers) || availableParallelism();

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
