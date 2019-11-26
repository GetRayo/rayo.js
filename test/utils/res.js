const { ServerResponse } = require('http');

const res = new ServerResponse('rayo');
module.exports = {
  ...res,
  setHeader: () => {},
  writeHead: () => {},
  write: () => {},
  end: () => {}
};
