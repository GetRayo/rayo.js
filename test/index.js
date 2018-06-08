const loadUnit = (unit) => require.call(null, `./${unit}`);

describe('Unit tests', () => {
  describe('Rayo', loadUnit('units/rayo'));
  describe('Bridge', loadUnit('units/bridge'));
  describe('Response', loadUnit('units/response'));

  describe('Integration tests', loadUnit('units/integration'));

  describe('Plugins', () => {
    describe('Compress', loadUnit('units/plugins/compress'));
  });
});
