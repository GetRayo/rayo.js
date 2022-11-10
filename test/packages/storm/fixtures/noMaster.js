// eslint-disable-next-line import/extensions
import { storm } from '../../../../packages/storm/index.js';

storm(
  () => {
    process.stdout.write('Worker!');
    process.exit();
  },
  {
    keepAlive: false,
    monitor: false,
    workers: parseInt(process.argv[2], 10)
  }
);
