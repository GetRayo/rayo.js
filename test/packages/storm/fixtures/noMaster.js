const { storm } = require('../../../../packages/storm');

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
