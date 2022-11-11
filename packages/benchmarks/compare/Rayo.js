import rayo from 'rayo';

const app = rayo({ port: 5050 });
app
  .get('/:say', (req, res) => {
    res.end(`Thunderstruck... ${req.params.say}`);
  })
  .start();
