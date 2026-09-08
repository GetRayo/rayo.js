import { constants, createBrotliCompress, createGzip } from 'node:zlib';

const types =
  /^(?:text\/(?:css|csv|html|javascript|plain|xml)|application\/(?:json|xml|javascript|[^;\s]+\+(?:json|xml)))(?:\s*;|$)/i;
const noTransform = /(?:^|,)\s*no-transform\s*(?:,|$)/i;

const vary = (res) => {
  const current = res.getHeader('vary');
  const values = (Array.isArray(current) ? current.join(', ') : String(current || '')).split(',');
  if (!values.some((value) => ['*', 'accept-encoding'].includes(value.trim().toLowerCase()))) {
    res.setHeader('vary', current ? `${values.join(',')}, Accept-Encoding` : 'Accept-Encoding');
  }
};

const negotiate = (header, preferBrotli) => {
  const quality = new Map();
  for (const item of String(header || '').split(',')) {
    const [name, ...parameters] = item.trim().toLowerCase().split(';');
    let weight = 1;
    for (const parameter of parameters) {
      const match = /^\s*q\s*=\s*(.*?)\s*$/.exec(parameter);
      if (match) weight = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(match[1]) ? Number(match[1]) : 0;
    }
    quality.set(name.trim(), weight);
  }
  const gzip = quality.get('gzip') ?? quality.get('*') ?? 0;
  const br = quality.get('br') ?? quality.get('*') ?? 0;
  if (Math.max(gzip, br) <= 0 || (quality.get('identity') ?? 0) > Math.max(gzip, br)) return null;
  return br > gzip || (br === gzip && preferBrotli) ? 'br' : 'gzip';
};

const positive = (value, fallback, minimum = 1) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= minimum ? number : fallback;
};

export default function compress({ preferBrotli = false, threshold = 1024, level = 6, chunkSize = 16 } = {}) {
  const minimum = positive(threshold, 1024, 0);
  const quality = positive(level, 6);
  const chunk = positive(Number(chunkSize) * 1024, constants.Z_DEFAULT_CHUNK, constants.Z_MIN_CHUNK);
  const gzipOptions = { chunkSize: chunk, level: Math.min(quality, 9) };
  const brotliParams = {
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    [constants.BROTLI_PARAM_QUALITY]: Math.min(quality, 11)
  };

  return (req, res, step) => {
    // Install before headers are sent; never switch representation halfway through a response.
    if (res.headersSent || res.destroyed || res.writableEnded) return step();
    const clientEncoding = negotiate(req.headers['accept-encoding'], preferBrotli);
    const { write, end, writeHead, emit } = res;
    let press;
    let decided = false;
    let outputBlocked = false;
    let awaitingDrain = false;
    let ending = false;
    let cleaned = false;
    let streamProperties;
    const callbacks = [];

    const complete = (error) => {
      for (const callback of callbacks.splice(0)) callback.call(res, error);
    };
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      res.removeListener('close', onClose);
      res.removeListener('error', onError);
      res.removeListener('finish', onFinish);
      res.emit = emit;
      for (const [name, descriptor] of streamProperties || []) {
        if (descriptor) Object.defineProperty(res, name, descriptor);
        else delete res[name];
      }
      if (press) press.destroy();
    };
    const onFinish = () => {
      cleanup();
      complete();
    };
    const onClose = () => {
      cleanup();
      complete(Object.assign(new Error('Response closed before completion'), { code: 'ERR_STREAM_PREMATURE_CLOSE' }));
    };
    const onError = (error) => {
      cleanup();
      complete(error);
      // The error has already been delivered to pending callbacks. Destroy without
      // re-emitting it after removing our response error listener.
      res.destroy();
    };
    const drain = () => {
      if (awaitingDrain && !outputBlocked && !press.writableNeedDrain && !ending && !cleaned) {
        awaitingDrain = false;
        emit.call(res, 'drain');
      }
    };

    const decide = (data, encoding, final = false) => {
      if (decided) return;
      decided = true;
      if (res.headersSent || res.destroyed) return;
      const status = res.statusCode;
      if (status < 200 || status === 204 || status === 205 || status === 304) return;
      if (res.getHeader('content-encoding') || res.getHeader('content-range')) return;
      if (noTransform.test(String(res.getHeader('cache-control') || ''))) return;
      if (!types.test(res.getHeader('content-type') || 'text/plain')) return;
      vary(res);
      if (!clientEncoding || req.method === 'HEAD') return;
      const length = res.getHeader('content-length');
      const hint =
        length === undefined ? (final ? (data ? Buffer.byteLength(data, encoding) : 0) : null) : Number(length);
      if (hint !== null && Number.isFinite(hint) && hint < minimum) {
        if (!res.getHeader('x-skip-compression')) res.setHeader('x-skip-compression', 'below threshold');
        return;
      }

      // Unknown-length streams compress from the first byte. This keeps memory bounded.
      if (clientEncoding === 'br') {
        const params = { ...brotliParams };
        if (hint !== null && Number.isFinite(hint) && hint >= 0) params[constants.BROTLI_PARAM_SIZE_HINT] = hint;
        press = createBrotliCompress({ chunkSize: chunk, params });
      } else {
        press = createGzip(gzipOptions);
      }
      res.setHeader('x-powered-by', ['@rayo/compress', res.getHeader('x-powered-by')].filter(Boolean).join(', '));
      res.setHeader('content-encoding', clientEncoding);
      res.removeHeader('content-length');
      streamProperties = ['writableEnded', 'writableNeedDrain'].map((name) => [
        name,
        Object.getOwnPropertyDescriptor(res, name)
      ]);
      Object.defineProperties(res, {
        writableEnded: { configurable: true, get: () => ending },
        writableNeedDrain: {
          configurable: true,
          get: () => !ending && !cleaned && (awaitingDrain || outputBlocked || press.writableNeedDrain)
        }
      });
      res.on('close', onClose);
      res.on('error', onError);
      res.on('finish', onFinish);
      press.on('error', onError);
      press.on('drain', drain);
      press.on('data', (data) => {
        if (cleaned) return;
        if (!write.call(res, data)) {
          outputBlocked = true;
          press.pause();
        }
      });
      press.on('end', () => {
        if (!cleaned) end.call(res);
      });
      // Socket drain only releases the compressed output. Producers must also wait
      // for the compressor's input buffer to drain before receiving their drain event.
      res.emit = function compressionEmit(event, ...args) {
        if (event !== 'drain') return emit.call(this, event, ...args);
        outputBlocked = false;
        press.resume();
        drain();
        return true;
      };
    };

    res.writeHead = function compressionWriteHead(statusCode, statusMessage, headers) {
      if (res.headersSent) return writeHead.apply(this, arguments);
      const fields = typeof statusMessage === 'object' ? statusMessage : headers;
      if (fields) {
        if (Array.isArray(fields)) {
          const seen = new Set();
          for (let index = 0; index < fields.length; index += 2) {
            const name = fields[index];
            const key = name.toLowerCase();
            if (seen.has(key)) res.appendHeader(name, fields[index + 1]);
            else res.setHeader(name, fields[index + 1]);
            seen.add(key);
          }
        } else {
          for (const name of Object.keys(fields)) res.setHeader(name, fields[name]);
        }
      }
      res.statusCode = statusCode;
      decide();
      return typeof statusMessage === 'string'
        ? writeHead.call(this, statusCode, statusMessage)
        : writeHead.call(this, statusCode);
    };

    res.write = function compressionWrite(data, encoding, callback) {
      decide(data, typeof encoding === 'string' ? encoding : undefined);
      if (!press || cleaned) return write.apply(this, arguments);
      if (!res.headersSent) res.writeHead(res.statusCode);
      const ready = press.write(data, encoding, callback);
      if (!ready || outputBlocked) awaitingDrain = true;
      return ready && !outputBlocked;
    };

    res.end = function compressionEnd(data, encoding, callback) {
      const payload = typeof data === 'function' ? undefined : data;
      const charset = typeof encoding === 'string' ? encoding : undefined;
      const done = typeof data === 'function' ? data : typeof encoding === 'function' ? encoding : callback;
      decide(payload, charset, true);
      if (!press || cleaned) return end.apply(this, arguments);
      if (!res.headersSent) res.writeHead(res.statusCode);
      if (typeof done === 'function') {
        if (res.writableFinished) process.nextTick(done.bind(res));
        else callbacks.push(done);
      }
      if (!ending) {
        ending = true;
        // Native end() uncorks the socket; do that before waiting for compressed output.
        while (res.writableCorked) res.uncork();
        press.end(payload, charset);
      } else if (payload !== undefined && payload !== null) {
        press.write(payload, charset);
      }
      return this;
    };

    return step();
  };
}
