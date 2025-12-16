import 'dotenv/config';
import appJson from './app.json';

export default () => {
  // Pega as variáveis de ambiente ou usa as do app.json como fallback
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || appJson.expo?.extra?.supabaseUrl;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || appJson.expo?.extra?.supabaseAnonKey;

  return {
    expo: {
      ...appJson.expo,
      extra: {
        ...appJson.expo?.extra,
        supabaseUrl: supabaseUrl || 'https://SEU-PROJETO.supabase.co',
        supabaseAnonKey: supabaseAnonKey || 'SEU_SUPABASE_ANON_KEY',
        eas: {
          ...appJson.expo?.extra?.eas,
        },
      },
    },
  };
};

