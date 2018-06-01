const { IncomingMessage } = require('http');

const req = new IncomingMessage('rayo');
module.exports = Object.assign({}, req, {
  headers: {
    host: 'localhost:5050',
    'user-agent': 'Rayo/1 Gecko/20100101',
    accept: 'text/html,text/plain,application/json',
    'accept-language': 'en-US,es,de,nl',
    'accept-encoding': 'gzip, deflate',
    connection: 'keep-alive',
    'upgrade-insecure-requests': '1'
  },
  url: '/',
  method: 'GET'
});
