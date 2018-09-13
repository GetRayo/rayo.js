const { storm } = require('../../../../packages/storm');

storm(
  () => {
    process.stdout.write('Worker!');
    process.send('Hello from the worker!');
    process.on('message', (message) => process.stdout.write(message));
    setTimeout(process.exit, 1000);
  },
  {
    keepAlive: false,
    monitor: false,
    workers: parseInt(process.argv[2], 10),
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
