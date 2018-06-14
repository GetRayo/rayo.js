/* eslint no-console: 0 */
const { storm } = require('../../../../packages/storm');

storm(
  () => {
    console.log('Worker!');
    process.send('Hello from the worker!');
    process.on('message', (message) => console.log(message));
    setTimeout(process.exit, 500);
  },
  {
    keepAlive: false,
    monitor: false,
    workers: parseInt(process.argv[2], 10),
    master(cluster) {
      console.log('Master!');
      const worker = cluster.workers[1];
      worker.on('message', (message) =>
        console.log(typeof message === 'object' ? JSON.stringify(message) : message)
      );

      worker.send(process.argv[4]);
    }
  }
);
