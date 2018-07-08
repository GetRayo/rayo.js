const uws = require('uws');

module.exports = (options = {}) => (req, res, step) => {

  step();
};
