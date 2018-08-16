const polka = require('polka');

const app = polka();
const handler = (req, res) => {
  res.end(`Thunderstruck... ${req.params.alias}`);
};

app.get('/users/:alias', handler).listen(5050);
