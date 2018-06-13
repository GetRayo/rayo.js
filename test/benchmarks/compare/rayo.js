const rayo = require('../../../packages/rayo/lib');

const app = rayo({ port: 5050 });
const handler = (req, res) => {
  res.end(`Thunderstruck... ${req.params.alias}`);
};

app.get('/users/:alias', handler).start();
