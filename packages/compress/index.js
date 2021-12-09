const compressible = require('compressible');
const { createGzip } = require('zlib');

const doable = (req, res) => {
  if (!res.compressPass && res.getHeader('content-encoding')) {
    return false;
  }

  const encoding = req.headers['accept-encoding'] || '';
  return encoding.indexOf('gzip') >= 0 && compressible(res.getHeader('content-type'));
};

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary
 */
const vary = (res, key) => {
  let header = res.getHeader('vary');
  if (!header) {
    res.setHeader('vary', key);
  } else if (header.trim() !== '*') {
    header = header.split(',').map((h) => h.trim());
    if (!header.includes(key)) {
      header.push(key);
      res.setHeader('vary', header.join(', '));
    }
  }
};

module.exports =
  (options = {}) =>
  (req, res, step) => {
    const { write, end } = res;
    const zip = createGzip(options);
    zip.on('data', write.bind(res)).on('end', end.bind(res));

    const press = (data, encoding) => {
      if (!res.getHeader('content-encoding')) {
        res.compressPass = true;
        res.setHeader('content-encoding', 'gzip');
        res.setHeader(
          'x-powered-by',
          ['@rayo/compress', res.getHeader('x-powered-by')].filter((header) => header).join(', ')
        );
        res.removeHeader('content-length');
        vary(res, 'content-encoding');
      }

      zip.write(Buffer.from(data, encoding));
    };

    res.write = (data, encoding = 'utf8') =>
      doable(req, res) ? press(data, encoding) : write.call(res, data, encoding);

    res.end = (data = null, encoding = 'utf8') => {
      if (!data) {
        return zip.end();
      }

      if (doable(req, res)) {
        press(data, encoding);
        return zip.end();
      }

      res.setHeader('content-length', data.length);
      return end.call(res, data, encoding);
    };

    step();
  };
