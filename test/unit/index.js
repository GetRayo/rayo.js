const rayo = require('../../bin/rayo');
const should = require('should');

describe('Unit testing', () => {
  it('Start', (done) => {
    should(rayo()).be.an.Object();
    done();
  });
});
