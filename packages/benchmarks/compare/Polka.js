import polka from 'polka';
import { ready, versionOf } from '../runtime.js';

const app = polka();
app
  .get('/:say', (req, res) => {
    res.end(`Thunderstruck... ${req.params.say}`);
  })
  .listen(0, '127.0.0.1', () => ready(app.server, { polka: versionOf('polka') }));
