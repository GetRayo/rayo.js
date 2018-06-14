/* eslint no-console: 0 */
const { storm } = require('../../../../packages/storm');

storm(
  () => {
    console.log('Worker!');
    process.exit();
  },
  {
    keepAlive: false,
    workers: parseInt(process.argv[2], 10),
    master() {
      console.log('Master!');
    }
  }
);
