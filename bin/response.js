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
 * @TODO Extend this to support more types.
 */
module.exports = {
  send(payload, statusCode) {
    const { valid, json } = isJSON(payload);
    const response = valid ? json : payload;
    this.writeHead(statusCode || 200, {
      'Content-Type': valid ? 'application/json' : 'text/plain',
      'Content-Length': (response || '').length
    });
    this.write(response);
    this.end();
  }
};
