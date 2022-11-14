import rayoTest from './packages/rayo/rayo.mjs';
import bridgeTest from './packages/rayo/bridge.mjs';
import compressTest from './packages/compress/index.mjs';
import sendTest from './packages/send/index.mjs';
import stormTest from './packages/storm/index.mjs';
import integrationTest from './integration.mjs';

describe('Unit tests', () => {
  describe('Packages', () => {
    describe('Rayo', () => {
      describe('rayo', rayoTest);
      describe('bridge', bridgeTest);
    });
    describe('Compress', compressTest);
    describe('Send', sendTest);
    describe('Storm', stormTest);
  });

  describe('Integration', integrationTest);
});
