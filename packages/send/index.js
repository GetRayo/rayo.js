const isJSON = (payload) => {
  let valid = false;
  const json = typeof payload !== 'string' ? JSON.stringify(payload) : payload;
  try {
    const parsed = JSON.parse(json);
    valid = typeof parsed === 'object' && parsed !== null;
  } catch (e) {
    // Invalid JSON
  }

  return { valid, json };
};

/**
 * @TODO Extend this to support more content-types.
 */
const sendIt = function sendIt(payload, statusCode = 200, statusText = '') {
  const { valid, json } = isJSON(payload);
  const response = valid ? json : payload;
  this.statusCode = statusCode;
  this.statusText = statusText;

  if (!this.getHeader('content-type')) {
    this.setHeader('content-type', valid ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
  }
  this.setHeader('content-length', (response || '').length);
  this.setHeader('x-powered-by', ['@rayo/send', this.getHeader('x-powered-by')].filter((header) => header).join(', '));

  this.end(response);
};

export default function send() {
  return (req, res, step) => {
    res.send = sendIt.bind(res);
    return step();
  };
}
