const NativeModules = require('react-native/Libraries/BatchedBridge/NativeModules');

// Ensure the jest-expo preset can attach mocks on RN >=0.76 where default may be missing
if (!NativeModules.default) {
  NativeModules.default = NativeModules;
}

