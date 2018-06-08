const compressible = require('compressible');
const { createGzip } = require('zlib');

const canPress = (req, res) => {
  if (!res.compressPass && res.getHeader('content-encoding')) {
    return false;
  }

  const encoding = req.headers['accept-encoding'] || '';
  return encoding.indexOf('gzip') >= 0 && compressible(res.getHeader('content-type'));
};

module.exports = (options = {}) => (req, res, step) => {
  const { write, end } = res;
  const zip = createGzip(options);
  zip.on('data', write.bind(res)).on('end', end.bind(res));

  const compress = (data, encoding) => {
    if (!res.getHeader('content-encoding')) {
      res.compressPass = true;
      res.setHeader('content-encoding', 'gzip');
      res.removeHeader('content-length');
    }

    zip.write(Buffer.from(data, encoding));
  };

  res.write = (data, encoding = 'utf8') =>
    canPress(req, res) ? compress(data, encoding) : write.call(res, data, encoding);

  res.end = (data = null, encoding = 'utf8') => {
    if (!data) {
      return zip.end();
    }

    if (canPress(req, res)) {
      compress(data, encoding);
      return zip.end();
    }

    res.setHeader('content-length', data.length);
    return end.call(res, data, encoding);
  };

  step();
};
