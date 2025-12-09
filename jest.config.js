module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?@?react-native|@react-native(-community)?|@expo|expo(nent)?|expo-modules-core|expo-router|expo-asset|expo-font|expo-constants|expo-linear-gradient|expo-linking|expo-splash-screen|expo-status-bar|expo-image-picker)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

