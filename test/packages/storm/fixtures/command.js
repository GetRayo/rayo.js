/* eslint import/extensions: 0 */

import { storm } from '@rayo/storm/index.js';

const [, , workers, , command] = process.argv;
storm(
  () => {
    process.stdout.write('Worker!');
    process.send('Hello from the worker!');
    process.on('message', () => {
      setTimeout(process.exit, 200);
    });
  },
  {
    keepAlive: false,
    monitor: false,
    workers,
    master(cluster) {
      const worker = cluster.workers[1];
      worker.on('message', (message) => {
        process.stdout.write(typeof message === 'object' ? JSON.stringify(message) : message);
      });

      setTimeout(() => worker.send(command), 200);
    }
  }
);
