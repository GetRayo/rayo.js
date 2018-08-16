const { storm } = require('../../../../packages/storm');

storm(
  () => {
    process.stdout.write('Worker!');
    setTimeout(() => process.exit(), 250);
  },
  {
    keepAlive: false,
    workers: parseInt(process.argv[2], 10),
    master() {
      process.stdout.write('Master!');
    }
  }
);
