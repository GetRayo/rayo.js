const { ServerResponse } = require('http');

const res = new ServerResponse('rayo');
module.exports = Object.assign(
  {},
  res,
  { setHeader: () => {} },
  { writeHead: () => {} },
  { write: () => {} },
  { end: () => {} }
);
