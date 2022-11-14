import rayo from 'rayo';

const app = rayo({ port: 5050, storm: { monitor: false } });
app
  .get('/:say', (req, res) => {
    res.end(`Thunderstruck... ${req.params.say}`);
  })
  .start();
