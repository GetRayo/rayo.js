import polka from 'polka';

const app = polka();
app
  .get('/:say', (req, res) => {
    res.end(`Thunderstruck... ${req.params.say}`);
  })
  .listen(5050);
