const loadUnit = (unit) => require.call(null, `./${unit}`);

describe('Unit tests', () => {
  describe('rayo.js', loadUnit('units/rayo'));
  describe('response.js', loadUnit('units/response'));
  describe('bridge.js', loadUnit('units/bridge'));
});
