const { storm } = require('../../../../packages/storm');

const workers = parseInt(process.argv[2], 10);
storm(() => {}, {
  keepAlive: false,
  workers,
  master() {
    process.stdout.write('Master!');

    this.on('worker', () => {
      this.stop();
    });
  }
});
