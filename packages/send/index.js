const TEXT = 'text/plain; charset=utf-8';
const JSON_TYPE = 'application/json; charset=utf-8';
const JSON_START = /^[\x20\t\n\r]*(?:[\[\{"\d-]|true|false|null)/;

const finish = (res, payload, type, statusCode, statusText) => {
  res.statusCode = statusCode;
  res.statusText = statusText;
  if (statusText) res.statusMessage = statusText;

  if (!res.getHeader('content-type')) res.setHeader('content-type', type);
  res.setHeader('content-length', Buffer.byteLength(payload));
  const poweredBy = res.getHeader('x-powered-by');
  res.setHeader('x-powered-by', poweredBy ? `@rayo/send, ${poweredBy}` : '@rayo/send');
  res.end(payload);
};

const sendIt = function sendIt(payload, statusCode = 200, statusText = '') {
  let response = payload;
  let type = TEXT;

  if (Buffer.isBuffer(payload)) {
    type = 'application/octet-stream';
  } else if (typeof payload === 'string') {
    // Explicit content types and ordinary text need no speculative JSON parsing.
    if (!this.getHeader('content-type') && JSON_START.test(payload)) {
      try {
        JSON.parse(payload);
        type = JSON_TYPE;
      } catch {
        // Preserve automatic text detection for malformed JSON strings.
      }
    }
  } else if (payload !== null && typeof payload === 'object') {
    response = JSON.stringify(payload) ?? '';
    type = JSON_TYPE;
  } else {
    response = payload == null ? '' : String(payload);
  }

  finish(this, response, type, statusCode, statusText);
};

const text = function text(payload, statusCode = 200, statusText = '') {
  finish(this, payload == null ? '' : String(payload), TEXT, statusCode, statusText);
};

const json = function json(payload, statusCode = 200, statusText = '') {
  finish(this, JSON.stringify(payload) ?? '', JSON_TYPE, statusCode, statusText);
};

const jsonString = function jsonString(payload, statusCode = 200, statusText = '') {
  if (typeof payload !== 'string') throw new TypeError('The serialized JSON payload must be a string.');
  finish(this, payload, JSON_TYPE, statusCode, statusText);
};

export default function send() {
  return (req, res, step) => {
    // Preserve the original helper's callback/extracted-function compatibility.
    res.send = sendIt.bind(res);
    res.text = text;
    res.json = json;
    res.jsonString = jsonString;
    return step();
  };
}
