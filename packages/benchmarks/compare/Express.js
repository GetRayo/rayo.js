const express = require('express');

const app = express();
app.disable('etag');
app.disable('x-powered-by');
const handler = (req, res) => {
  res.end(`Thunderstruck... ${req.params.alias}`);
};

app.get('/users/:alias', handler).listen(5050);
