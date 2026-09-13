import express from 'express';
import { ready, versionOf } from '../runtime.js';

const app = express();
app.disable('etag');
app.disable('x-powered-by');

app.get('/:say', (req, res) => {
  res.end(`Thunderstruck... ${req.params.say}`);
});
const server = app.listen(0, '127.0.0.1', () => ready(server, { express: versionOf('express') }));
