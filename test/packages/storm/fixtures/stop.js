const { storm } = require('../../../../packages/storm');

const workers = parseInt(process.argv[2], 10);
storm(() => {}, {
  monitor: false,
  workers,
  master() {
    this.on('worker', () => {
      this.stop();
    });
  }
});
