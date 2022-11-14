import { IncomingMessage } from 'http';

const incoming = new IncomingMessage('rayo');
const req = {
  ...incoming,
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
};

export default req;
