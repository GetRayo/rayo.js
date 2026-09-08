import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import monitor from '../../../packages/storm/monitor.mjs';

export default function monitorPathTests() {
  it('routes monitor requests using only the pathname across query and absolute request forms', async () => {
    const server = createServer();
    monitor.service.start({ workers: {} }, { server, monitorPort: 0 });
    await once(server, 'listening');
    try {
      for (const [path, status, body] of [
        ['/monitor', 200, '[]'],
        ['/monitor?service=wrong', 200, '[]'],
        ['http://example.test/monitor?x=1', 200, '[]'],
        ['/monitor/5?worker=6', 200, 'Worker 5 does not exist.'],
        ['/monitors?service=monitor', 404, 'This service does not exist.'],
        ['/monitor%2F5', 404, 'This service does not exist.'],
        ['/monitor/../wrong', 200, '[]']
      ]) {
        const received = await new Promise((resolve, reject) => {
          request({ host: '127.0.0.1', port: server.address().port, path }, (res) => {
            let payload = '';
            res.setEncoding('utf8').on('data', (chunk) => {
              payload += chunk;
            });
            res.on('end', () => resolve({ status: res.statusCode, body: payload })).on('error', reject);
          })
            .on('error', reject)
            .end();
        });
        assert.deepEqual(received, { status, body }, path);
      }
    } finally {
      const closed = once(server, 'close');
      monitor.service.stop();
      await closed;
    }
  });
}
