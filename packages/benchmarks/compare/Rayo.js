import { Readable } from 'node:stream';
import { config, loadPackage, versionOf, ready, readyCluster } from '../runtime.js';
import { payloads } from '../workloads.js';

const { default: rayo } = await loadPackage('rayo', config['rayo-path']);
const versions = { rayo: versionOf('rayo', config['rayo-path']) };
const options = {
  port: 0,
  host: '127.0.0.1',
  notFound: (req, res) => {
    res.statusCode = 404;
    res.end('not found');
  }
};
if (config.mode === 'cluster') {
  versions['@rayo/storm'] = versionOf('@rayo/storm');
  options.storm = {
    workers: config['server-workers'],
    monitor: false,
    keepAlive: false,
    master: () => readyCluster(versions)
  };
}
const app = rayo(options);
const workload = config.workload;

if (['static', 'param', 'wildcard', 'miss'].includes(workload.kind)) {
  for (let index = 0; index < workload.count; index += 1) {
    const suffix = workload.kind === 'param' ? '/:name' : workload.kind === 'wildcard' ? '/*' : '';
    app.get(`/route-${index}${suffix}`, (req, res) => res.end(workload.kind === 'param' ? req.params.name : 'ok'));
  }
} else if (workload.kind === 'middleware') {
  for (let index = 0; index < workload.depth; index += 1) {
    app.through((req, res, next) => {
      req.visited = (req.visited || 0) + 1;
      next();
    });
  }
  app.get('/hello', (req, res) => res.end(`${req.visited || 0}`));
} else if (workload.kind === 'response') {
  if (workload.mode !== 'raw') {
    const { default: send } = await loadPackage('@rayo/send', config['send-path']);
    versions['@rayo/send'] = versionOf('@rayo/send', config['send-path']);
    app.through(send());
  }
  app.get('/hello', (req, res) => {
    switch (workload.mode) {
      case 'raw':
        return res.end(payloads.text);
      case 'auto-text':
        return res.send(payloads.text);
      case 'text':
        return res.text(payloads.text);
      case 'object':
        return res.send(payloads.object);
      case 'json':
        return res.json(payloads.object);
      case 'json-string':
        return res.jsonString(payloads.json);
      case 'header-json':
        res.setHeader('content-type', 'application/json; charset=utf-8');
        return res.send(payloads.json);
      default:
        throw new Error('Unknown response workload');
    }
  });
} else if (workload.kind === 'query') {
  app.get('/hello', (req, res) => res.end(JSON.stringify(req.query)));
} else if (workload.kind === 'stream') {
  if (workload.encoding) {
    const { default: compress } = await loadPackage('@rayo/compress', config['compress-path']);
    versions['@rayo/compress'] = versionOf('@rayo/compress', config['compress-path']);
    app.through(compress({ preferBrotli: workload.encoding === 'br' }));
  }
  const chunks = [];
  for (let offset = 0; offset < payloads.stream.length; offset += workload.chunkSize) {
    chunks.push(Buffer.from(payloads.stream.slice(offset, offset + workload.chunkSize)));
  }
  app.get('/hello', (req, res) => {
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    Readable.from(chunks).pipe(res);
  });
} else {
  app.get('/:say', (req, res) => res.end(`Thunderstruck... ${req.params.say}`));
}

app.start(() => ready(app.server, versions));
