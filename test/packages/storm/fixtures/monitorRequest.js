import { request } from 'http';
// eslint-disable-next-line import/extensions
import { storm } from '../../../../packages/storm/index.js';

const workers = parseInt(process.argv[2], 10);
storm(() => {}, {
  keepAlive: false,
  monitor: true,
  monitorPort: 65000,
  workers,
  master() {
    this.on('worker', () => {
      const workerId = parseInt(process.argv[3], 10) || '';
      const req = request(
        {
          host: 'localhost',
          port: 65000,
          path: `/${process.argv[5]}/${workerId}`
        },
        (response) => {
          let data = [];
          response.on('data', (chunk) => data.push(chunk));
          response.on('end', () => {
            data = data.join('');
            process.stdout.write(response.text);
            this.stop();
          });
        }
      );

      req.end();
    });
  }
});
