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

const sizeOf = (data, encoding) => (data ? Buffer.byteLength(data, encoding) : 0);
export default function compress(options = { gzip: {}, brotli: {} }) {
  return (req, res, step) => {
    let clientEncoding = req.headers['accept-encoding'];
    [clientEncoding] = clientEncoding.match(/\bbr\b/i) || clientEncoding.match(/\bgzip\b/i) || [];

    if (!clientEncoding) {
      return step();
    }

    const { write, end } = res;
    let press;
    let sizeHint = 0;
    let isPressing = false;
    const init = function init() {
      isPressing = true;

      const accepted = /(text\/(css|csv|html|javascript|plain|xml))|(application\/(json|xml))/i;
      const canPress = accepted.test(res.getHeader('content-type') || 'text/plain');

      if (canPress && clientEncoding) {
        const poweredBy = ['@rayo/compress', res.getHeader('x-powered-by')].filter((h) => h).join(', ');
        res.setHeader('x-powered-by', poweredBy);
        res.setHeader('content-encoding', clientEncoding);
        res.removeHeader('content-length');
        vary({ res, key: 'content-encoding' });

        sizeHint = res.getHeader('content-length') || sizeHint;
        if (clientEncoding === 'br') {
          press = createBrotliCompress({
            ...options.brotli,
            params: {
              [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
              [constants.BROTLI_PARAM_QUALITY]: options.brotli?.level || 4,
              [constants.BROTLI_PARAM_SIZE_HINT]: sizeHint
            }
          });
        } else {
          press = createGzip(options.gzip);
        }

        press.on('data', (...args) => write.apply(res, args) === false && press.pause());
        press.on('end', (...args) => end.apply(res, args));
        res.on('drain', () => press.resume());
      }
    };

    res.write = function zipWrite(...args) {
      const [data, encoding] = args;
      sizeHint += sizeOf(data, encoding);
      if (!isPressing) {
        init();
      }

      return press ? press.write(...args) : write.apply(this, args);
    };

    res.end = function zipEnd(...args) {
      const [data, encoding] = args;
      sizeHint += sizeOf(data, encoding);
      if (!data && isPressing) {
        return press.end();
      }

      if (!isPressing) {
        init();
      }

      return press ? press.end(...args) : end.apply(this, args);
    };

    return step();
  };
}
