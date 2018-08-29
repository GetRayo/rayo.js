const { storm } = require('../../../../packages/storm');

storm(
  () => {
    process.stdout.write('Worker!');
    setTimeout(() => process.exit(), 750);
  },
  {
    keepAlive: false,
    monitor: false,
    workers: parseInt(process.argv[2], 10),
    master() {
      process.stdout.write('Master!');
    }
  }
);
