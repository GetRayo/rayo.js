const { storm } = require('../../../../packages/storm');

storm(
  () => {
    process.stdout.write('Worker!');
    process.exit();
  },
  {
    monitor: false,
    workers: parseInt(process.argv[2], 10),
    master() {
      process.stdout.write('Master!');
      setTimeout(this.stop, 1000);
    }
  }
);
