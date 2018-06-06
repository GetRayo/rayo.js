const compressible = require('compressible');
const { createGzip } = require('zlib');

const canPress = (req, res) => {
  const encoding = req.headers['accept-encoding'] || '';
  return encoding.indexOf('gzip') >= 0 && compressible(res.getHeader('content-type'));
};

module.exports = (options = {}) => (req, res, step) => {
  const { write, end } = res;
  const zip = createGzip(options);
  zip.on('data', write.bind(res)).on('end', end.bind(res));

  const compress = (data, encoding) => {
    if (!res.getHeader('content-encoding')) {
      res.setHeader('content-encoding', 'gzip');
      res.removeHeader('content-length');
    }

    zip.write(Buffer.from(data, encoding));
  };

  res.write = (data = null, encoding = 'utf8') =>
    canPress(req, res) ? compress(data, encoding) : write.call(res, data, encoding);

  res.end = (data = null, encoding = 'utf8') => {
    if (!data) {
      return zip.end();
    }

    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', 'text/plain');
    }

    if (canPress(req, res)) {
      compress(data, encoding);
      return zip.end();
    }

    return end.call(res, data, encoding);
  };

  step();
};
