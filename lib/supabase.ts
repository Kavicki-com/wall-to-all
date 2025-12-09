import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
╔══════════════════════════════════════════════════════════════╗
║  ERRO: Variáveis de ambiente do Supabase não configuradas   ║
╚══════════════════════════════════════════════════════════════╝

Para corrigir este erro, você precisa configurar as credenciais do Supabase.

OPÇÃO 1 - Arquivo .env.local (Recomendado):
  1. Crie um arquivo .env.local na raiz do projeto
  2. Adicione as seguintes linhas:
  
     EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
     EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui

OPÇÃO 2 - Arquivo app.json:
  Adicione as credenciais em app.json:
  
    "expo": {
      "extra": {
        "supabaseUrl": "https://seu-projeto.supabase.co",
        "supabaseAnonKey": "sua-chave-anon-aqui"
      }
    }

COMO OBTER AS CREDENCIAIS:
  1. Acesse https://app.supabase.com
  2. Selecione seu projeto
  3. Vá em Settings > API
  4. Copie a "Project URL" e a "anon public key"

Veja o arquivo .env.example para um template de referência.
  `.trim();
  
  console.error(errorMessage);
  throw new Error('Variáveis de ambiente do Supabase não configuradas. Veja o console para instruções detalhadas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Tratamento de erros de refresh token será feito no AuthContext
  },
});

// Função utilitária para limpar tokens inválidos
export const clearInvalidAuthTokens = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const supabaseKeys = keys.filter(key => 
      key.includes('supabase') || 
      key.includes('auth') ||
      key.startsWith('sb-') ||
      key.includes('supabase.auth.token')
    );
    
    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
      console.log('[Supabase] Tokens inválidos removidos do AsyncStorage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Supabase] Erro ao limpar tokens:', error);
    return false;
  }
};
