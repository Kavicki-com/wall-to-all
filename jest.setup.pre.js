// Load environment variables for Jest tests
require('dotenv').config({ path: '.env.test' });

// Set safe defaults to avoid undefined values
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test_anon_key';

const NativeModules = require('react-native/Libraries/BatchedBridge/NativeModules');

// Ensure the jest-expo preset can attach mocks on RN >=0.76 where default may be missing
if (!NativeModules.default) {
  NativeModules.default = NativeModules;
}

