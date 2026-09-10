import { createServer } from 'node:http';
import rayo, { type Handler, type Request, type Response, type RayoOptions } from 'rayo';
import send, { type SendResponse, type SendMiddleware } from '@rayo/send';
import compress, { type CompressOptions, type CompressionMiddleware } from '@rayo/compress';
import Storm, { storm, type StormOptions, type WorkerFunction } from '@rayo/storm';

interface AppRequest extends Request {
  account: string;
}
const authenticate: Handler<AppRequest, SendResponse> = (req, _res, next) => {
  req.account = 'example';
  return next();
};
const compression: CompressOptions = { preferBrotli: true, threshold: 512, level: 4, chunkSize: 32 };
const sender: SendMiddleware = send();
const zipper: CompressionMiddleware = compress(compression);
const app = rayo<AppRequest, SendResponse>({
  server: createServer(),
  onError(error, req, res, handler) {
    const message = error instanceof Error ? error.message : String(error);
    res.text(`${req.account}: ${message}`, 400);
    handler?.(req, res, () => {});
  },
  notFound(req, res) {
    res.json({ path: req.pathname }, 404);
  }
});
app.through(sender, zipper, authenticate);
app.get('/hello/:name', async (req, res) => {
  const name: string | undefined = req.params.name;
  const query: string | string[] | undefined = req.query.tag;
  res.json({ name, query, account: req.account });
});
app
  .bridge('/files')
  .through(authenticate)
  .get((_req, res) => res.send(Buffer.from('hello')))
  .post((_req, res) => res.text('created', 201))
  .all((_req, res) => res.jsonString('{"ok":true}'));
app
  .bridge()
  .get('/nested', (_req, res) => res.json(null))
  .bridge('/more')
  .get((_req, res) => res.send());
app.route('PATCH', '/files', (_req, res) => res.text('updated'));
app.prepare().through();
const found = app.fetch('GET', '/hello/world');
if (found) {
  const handlers: Handler<AppRequest, SendResponse>[] = found.dispatchStack;
  const name: string | undefined = found.params.name;
  void handlers;
  void name;
}
const server = app.start(({ port, workerPid, address }) => {
  const tuple: [number, number, string] = [port, workerPid, address];
  void tuple;
});
server?.close();
createServer(app.dispatch);

const basic = rayo();
basic.get('/', (req, res, next) => {
  const typedReq: Request = req;
  const typedRes: Response = res;
  res.send?.('optional middleware');
  // @ts-expect-error Helpers are optional until a middleware response type is selected.
  res.json({ ok: true });
  next();
  void typedReq;
  void typedRes;
});
const settings: RayoOptions = { host: '127.0.0.1', port: 0 };
rayo(settings);

const options: StormOptions = {
  workers: '2',
  monitor: false,
  keepAlive: true,
  monitorPort: 5051,
  master(cluster) {
    const pid: number = cluster.masterPid;
    this.on('worker', (workerPid) => {
      const n: number = workerPid;
      void n;
    });
    void pid;
  }
};
const work: WorkerFunction = function () {
  const count: number = this.workers;
  void count;
};
const clustered: Storm = storm(work, options);
new Storm(work);
clustered.on('exit', (pid) => {
  const n: number = pid;
  void n;
});
clustered.once('offline', () => {});
rayo({ storm: options });

// @ts-expect-error Port is numeric.
rayo({ port: '5050' });
// @ts-expect-error A bound bridge's verb methods omit the path.
app.bridge('/fixed').get('/other', (_req, _res) => {});
// @ts-expect-error Unbound routing requires a path.
app.get((_req, _res) => {});
// @ts-expect-error Compression threshold is numeric.
compress({ threshold: 'small' });
// @ts-expect-error Worker callback is required.
storm();
// @ts-expect-error Worker counts cannot be booleans.
storm(work, { workers: false });
// @ts-expect-error Event carries a numeric process ID.
clustered.on('worker', (pid: string) => {});
app.get('/bad', (_req, res) => {
  // @ts-expect-error Serialized JSON must already be a string.
  res.jsonString({ ok: true });
  // @ts-expect-error HTTP status is numeric.
  res.send('bad', '200');
});
