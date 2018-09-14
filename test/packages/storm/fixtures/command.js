const { storm } = require('../../../../packages/storm');

const workers = parseInt(process.argv[2], 10);
storm(
  () => {
    process.stdout.write('Worker!');
    process.send('Hello from the worker!');
    process.on('message', (message) => {
      process.stdout.write(message);
      setTimeout(process.exit, 250);
    });
  },
  {
    keepAlive: false,
    monitor: false,
    workers,
    master(cluster) {
      process.stdout.write('Master!');
      const worker = cluster.workers[1];
      worker.on('message', (message) =>
        process.stdout.write(
          typeof message === 'object' ? JSON.stringify(message) : message
        )
      );

      worker.send(process.argv[4]);
    }
  }
);
