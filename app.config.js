import 'dotenv/config';
import appJson from './app.json';

export default () => {
  // Função auxiliar para verificar se um valor é um placeholder
  const isPlaceholder = (value) => {
    if (!value) return true;
    const placeholders = [
      'https://SEU-PROJETO.supabase.co',
      'https://seu-projeto.supabase.co',
      'SEU_SUPABASE_ANON_KEY',
      'sua-chave-anon-aqui'
    ];
    return placeholders.includes(value);
  };

  // Pega as variáveis de ambiente ou usa as do app.json como fallback (se não forem placeholders)
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const appJsonUrl = appJson.expo?.extra?.supabaseUrl;
  const appJsonKey = appJson.expo?.extra?.supabaseAnonKey;

  // Usa valores do app.json apenas se não forem placeholders
  const supabaseUrl = envUrl || (!isPlaceholder(appJsonUrl) ? appJsonUrl : undefined);
  const supabaseAnonKey = envKey || (!isPlaceholder(appJsonKey) ? appJsonKey : undefined);

  // Usa valores padrão se não houver valores válidos
  const finalSupabaseUrl = supabaseUrl || 'https://yykqzdiktqlzmvnnokfj.supabase.co';
  const finalSupabaseAnonKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5a3F6ZGlrdHFsem12bm5va2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNTUxNTcsImV4cCI6MjA3OTgzMTE1N30.4dNJ2txnT6Sgjq4Wy5g1uWiaTvWMvywDRk3ZxhIFICU';

  return {
    expo: {
      ...appJson.expo,
      extra: {
        ...appJson.expo?.extra,
        supabaseUrl: finalSupabaseUrl,
        supabaseAnonKey: finalSupabaseAnonKey,
        eas: {
          ...appJson.expo?.extra?.eas,
        },
      },
    },
  };
};

