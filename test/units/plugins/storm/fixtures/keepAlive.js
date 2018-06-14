/* eslint no-console: 0 */
const { storm } = require('../../../../../packages/storm');

storm(
  () => {
    console.log('Worker!');
    process.exit();
  },
  {
    monitor: false,
    workers: parseInt(process.argv[2], 10),
    master() {
      console.log('Master!');
      setTimeout(this.stop, 500);
    }
  }
);
