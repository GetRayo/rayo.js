import express from 'express';

const app = express();
app.disable('etag');
app.disable('x-powered-by');

app
  .get('/:say', (req, res) => {
    res.end(`Thunderstruck... ${req.params.say}`);
  })
  .listen(5050);
