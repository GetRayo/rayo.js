import rayoTest from './packages/rayo/rayo.mjs';
import bridgeTest from './packages/rayo/bridge.mjs';
import performanceTest from './packages/rayo/performance.mjs';
import requestTests from './packages/rayo/request.mjs';
import routeParserTests from './packages/rayo/route-parser.mjs';
import compressTest from './packages/compress/index.mjs';
import sendTest from './packages/send/index.mjs';
import stormTest from './packages/storm/index.mjs';
import monitorPathTests from './packages/storm/pathname.mjs';
import integrationTest from './integration.mjs';
import benchmarkTests from './benchmarks/index.js';

describe('Unit tests', () => {
  describe('Packages', () => {
    describe('Rayo', () => {
      describe('rayo', rayoTest);
      describe('bridge', bridgeTest);
      describe('routing and middleware', performanceTest);
      describe('request targets', requestTests);
      describe('route compiler', routeParserTests);
    });
    describe('Compress', compressTest);
    describe('Send', sendTest);
    describe('Storm', stormTest);
    describe('Storm monitor routing', monitorPathTests);
  });

  describe('Integration', integrationTest);
  describe('Benchmarks', benchmarkTests);
});
