const actual = require('react-native/Libraries/BatchedBridge/NativeModules');

// Ensure consumers (like jest-expo preset) have a default export to patch
if (!actual.default) {
  actual.default = actual;
}

if (!actual.NativeUnimoduleProxy) {
  actual.NativeUnimoduleProxy = { viewManagersMetadata: {} };
}

if (!actual.UIManager) {
  actual.UIManager = {};
}

module.exports = actual;

