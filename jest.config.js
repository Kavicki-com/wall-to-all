const jestPreset = require('jest-expo/jest-preset');

module.exports = {
  ...jestPreset,
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.pre.js', ...(jestPreset.setupFiles || [])],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', ...(jestPreset.setupFilesAfterEnv || [])],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?@?react-native|@react-native(-community)?|react-native-gesture-handler|@expo|expo(nent)?|expo-modules-core|expo-router|expo-asset|expo-font|expo-constants|expo-linear-gradient|expo-linking|expo-splash-screen|expo-status-bar|expo-image-picker|@sentry)/)',
  ],
  moduleNameMapper: {
    ...(jestPreset.moduleNameMapper || {}),
    '^react-native/Libraries/BatchedBridge/NativeModules$':
      '<rootDir>/__mocks__/NativeModulesMock.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

