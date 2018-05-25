const rayo = require('../../bin');
const should = require('should');

describe('Unit testing', () => {
  it('Start', (done) => {
    should(rayo()).be.an.Object();
    done();
  });
});
