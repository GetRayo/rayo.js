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
const send = function send(payload, statusCode) {
  const { valid, json } = isJSON(payload);
  const response = valid ? json : payload;
  this.statusCode = statusCode || 200;
  this.setHeader('Content-Length', (response || '').length);
  this.setHeader('Content-Type', valid ? 'application/json' : 'text/plain');
  this.end(response);
};

module.exports = () => (req, res, step) => {
  res.send = send.bind(res);
  step();
};
