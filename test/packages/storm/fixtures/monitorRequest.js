const request = require('supertest');
const { storm } = require('../../../../packages/storm');

const workers = parseInt(process.argv[2], 10);
storm(() => {}, {
  keepAlive: false,
  monitor: true,
  monitorPort: 65000,
  workers,
  master() {
    process.stdout.write('Master!');

    this.on('worker', () => {
      const workerId = parseInt(process.argv[3], 10) || '';
      request('http://localhost:65000')
        .get(`/${process.argv[5]}/${workerId}`)
        .end((error, response) => {
          process.stdout.write(response.text);
          this.stop();
        });
    });
  }
});
