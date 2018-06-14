/* eslint no-console: 0 */
const { storm } = require('../../../../../packages/storm');

storm(
  () => {
    console.log('Worker!');
    setTimeout(process.exit, 250);
  },
  {
    keepAlive: false,
    monitor: false,
    workers: parseInt(process.argv[2], 10),
    master() {
      console.log('Master!');
    }
  }
);
