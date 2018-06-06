const compressible = require('compressible');
const { PassThrough } = require('stream');
const { createGzip } = require('zlib');

const canCompress = (req, res) => {
  const encoding = req.headers['accept-encoding'] || '';
  const accepts = encoding.indexOf('gzip') >= 0;
  return accepts && compressible(res.getHeader('content-type'));
};

module.exports = (options = {}) => (req, res, step) => {
  const buffers = [];
  const { write, end } = res;

  res.write = (data = null, encoding = 'utf8') => {
    if (data && typeof data === 'string') {
      buffers.push(Buffer.from(data, encoding));
    }
  };

  res.end = function resEnd(data = null, encoding = 'utf8') {
    res.write(data, encoding);
    if (!canCompress(req, res)) {
      end.call(this, Buffer.concat(buffers).toString(), encoding);
    } else {
      res.removeHeader('Content-Length');
      res.setHeader('Content-Encoding', 'gzip');

      const zip = createGzip(options);
      const bufferStream = new PassThrough();
      bufferStream.pipe(zip);
      bufferStream.end(Buffer.concat(buffers));

      zip.on('data', (chunk) => {
        write.call(this, chunk, encoding);
      });

      zip.on('end', () => end.call(this));
    }
  };

  step();
};
