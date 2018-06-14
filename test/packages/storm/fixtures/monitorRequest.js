/* eslint no-console: 0 */
const request = require('supertest');

const { storm } = require('../../../../packages/storm');

storm(
  () => {
    console.log('Worker!');
  },
  {
    keepAlive: false,
    monitor: true,
    monitorPort: 65000,
    workers: parseInt(process.argv[2], 10),
    master() {
      console.log('Master!');
      setTimeout(() => {
        const workerId = parseInt(process.argv[3], 10) || '';
        request('http://localhost:65000')
          .get(`/monitor/${workerId}`)
          .end((error, response) => {
            console.log(response.text);
            this.stop();
          });
      }, 500);
    }
  }
);
