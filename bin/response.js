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
    this.writeHead(statusCode || 200, {
      'Content-Type': valid ? 'application/json' : 'text/plain'
    });
    this.write(valid ? json : payload);
    this.end();
  }
};
