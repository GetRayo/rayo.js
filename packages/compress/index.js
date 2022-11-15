import { constants, createBrotliCompress, createGzip } from 'zlib';

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary
 */
const vary = function vary({ res, key }) {
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

const types = /(text\/(css|csv|html|javascript|plain|xml))|(application\/(json|xml))/i;
export default function compress({ preferBrotli = false, threshold = 1024, level = 6, chunkSize = 16 } = {}) {
  return (req, res, step) => {
    let clientEncoding = req.headers['accept-encoding'];
    const [br] = clientEncoding.match(/\bbr\b/i) || [];
    const [gzip] = clientEncoding.match(/\bgzip\b/i) || [];

    clientEncoding = (br && preferBrotli) || (br && !gzip) ? br : gzip;
    if (!clientEncoding || req.method === 'HEAD') {
      return step();
    }

    let press;
    let sizeHint = 0;
    const { write, end } = res;

    const init = function init([data, encoding]) {
      sizeHint += data ? Buffer.byteLength(data, encoding) : 0;
      const go = sizeHint >= threshold;
      if (!go && !res.getHeader('x-skip-compression')) {
        res.setHeader('x-skip-compression', 'below threshold');
      }

      const pressType = types.test(res.getHeader('content-type') || 'text/plain');
      if (!press && pressType && clientEncoding && go) {
        const poweredBy = ['@rayo/compress', res.getHeader('x-powered-by')].filter((h) => h).join(', ');
        res.setHeader('x-powered-by', poweredBy);
        res.setHeader('content-encoding', clientEncoding);
        res.removeHeader('content-length');
        vary({ res, key: 'content-encoding' });

        const chunk = +chunkSize * 1024 || constants.Z_DEFAULT_CHUNK;
        const pressLevel = +level >= 1 ? level : 6;
        sizeHint = +res.getHeader('content-length') || sizeHint;
        if (clientEncoding === 'br') {
          press = createBrotliCompress({
            chunkSize: chunk,
            params: {
              [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
              [constants.BROTLI_PARAM_QUALITY]: pressLevel <= 11 ? pressLevel : 11,
              [constants.BROTLI_PARAM_SIZE_HINT]: sizeHint
            }
          });
        } else {
          press = createGzip({
            chunkSize: chunk,
            level: pressLevel <= 9 ? pressLevel : 9
          });
        }

        press.on('data', (...args) => write.apply(res, args) === false && press.pause());
        press.on('end', (...args) => end.apply(res, args));
        res.on('drain', () => press.resume());
      }
    };

    res.write = function zipWrite(...args) {
      init(args);
      return press ? press.write(...args) : write.apply(this, args);
    };

    res.end = function zipEnd(...args) {
      init(args);
      return press ? press.end(...args) : end.apply(this, args);
    };

    return step();
  };
}
