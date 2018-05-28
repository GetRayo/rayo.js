const { IncomingMessage } = require('http');

const req = new IncomingMessage('rayo');
module.exports = Object.assign({}, req, {
  headers: {
    host: 'localhost:5050',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:59.0) Gecko/20100101 Firefox/59.0',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,es;q=0.7,de;q=0.3',
    'accept-encoding': 'gzip, deflate',
    connection: 'keep-alive',
    'upgrade-insecure-requests': '1'
  },
  url: '/',
  method: 'GET'
});
