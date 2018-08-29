const request = require('supertest');

const { storm } = require('../../../../packages/storm');

storm(() => process.stdout.write('Worker!'), {
  keepAlive: false,
  monitor: true,
  monitorPort: 65000,
  workers: parseInt(process.argv[2], 10),
  master() {
    process.stdout.write('Master!');
    setTimeout(() => {
      const workerId = parseInt(process.argv[3], 10) || '';
      request('http://localhost:65000')
        .get(`/${process.argv[5]}/${workerId}`)
        .end((error, response) => {
          process.stdout.write(response.text);
          this.stop();
        });
    }, 750);
  }
});
