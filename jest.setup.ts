/* eslint-disable @typescript-eslint/no-require-imports */
import '@testing-library/jest-native/extend-expect';

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
}));

jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: () => true,
  processFontFamily: (family: string) => family,
}));

jest.mock('@expo/vector-icons', () => {
  const MockIcon = () => null;
  return {
    AntDesign: MockIcon,
    MaterialIcons: MockIcon,
    Ionicons: MockIcon,
    FontAwesome: MockIcon,
    Feather: MockIcon,
    createIconSet: () => MockIcon,
    createIconSetFromIcoMoon: () => MockIcon,
    createIconSetFromFontello: () => MockIcon,
  };
});

jest.mock('react-native-gesture-handler', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    State: {},
    default: View,
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

