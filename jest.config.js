module.exports = {
    preset: 'jest-expo',
    // Só arquivos *.test/*.spec são suites. Permite helpers compartilhados em
    // __tests__/ (ex.: __tests__/test-utils.tsx) sem virarem "suites vazias".
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg)',
    ],
};
