import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Obter variáveis de ambiente do Expo
// No Expo, variáveis de ambiente devem ter o prefixo EXPO_PUBLIC_ para serem acessíveis no cliente
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://yykqzdiktqlzmvnnokfj.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5a3F6ZGlrdHFsem12bm5va2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNTUxNTcsImV4cCI6MjA3OTgzMTE1N30.4dNJ2txnT6Sgjq4Wy5g1uWiaTvWMvywDRk3ZxhIFICU';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] Variáveis de ambiente do Supabase não configuradas. Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
