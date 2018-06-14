const loadUnit = (unit) => require.call(null, `./${unit}`);

describe('Unit tests', () => {
  describe('Packages', () => {
    describe('Rayo', () => {
      describe('rayo', loadUnit('packages/rayo'));
      describe('bridge', loadUnit('packages/rayo/bridge'));
    });
    describe('Compress', loadUnit('packages/compress'));
    describe('Send', loadUnit('packages/send'));
    describe('Storm', loadUnit('packages/storm'));
  });

  describe('Integration tests', loadUnit('integration'));
});
