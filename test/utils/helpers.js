const should = require('should');
const { createServer } = require('http');

module.exports = {
  header: (key = null, value = null) => (res) => {
    should(res).be.an.Object();
    should(res.headers).be.an.Object();

    if (value) {
      should(res.headers).with.property(key);
      should(res.headers[key])
        .be.a.String()
        .and.equal(value);
    } else {
      should.not.exist(res.headers[key]);
    }
  },

  size: (size) => (res) => {
    should(res.text.length)
      .be.a.Number()
      .and.equal(size);
  },

  wrap: (module, handler, options) =>
    createServer((req, res) =>
      module(options)(
        req,
        res,
        (error) => (error ? res.end(error.message) : handler(req, res))
      )
    )
};
