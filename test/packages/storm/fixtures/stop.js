const { storm } = require('../../../../packages/storm');

const workers = parseInt(process.argv[2], 10);
storm(() => {}, {
  monitor: false,
  workers,
  master() {
    process.stdout.write('Master!');

    this.on('worker', () => {
      this.stop();
    });
  }
});
