import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Verifica se as credenciais são válidas (não são placeholders)
const isValidUrl = supabaseUrl && 
  supabaseUrl !== 'https://SEU-PROJETO.supabase.co' && 
  supabaseUrl !== 'https://seu-projeto.supabase.co' &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('.supabase.co');

const isValidKey = supabaseAnonKey && 
  supabaseAnonKey !== 'SEU_SUPABASE_ANON_KEY' &&
  supabaseAnonKey !== 'sua-chave-anon-aqui' &&
  supabaseAnonKey.length > 20;

if (!isValidUrl || !isValidKey) {
  // Only show detailed error message outside of test environment
  if (process.env.NODE_ENV !== 'test') {
    const errorMessage = `
╔══════════════════════════════════════════════════════════════╗
║  ERRO: Variáveis de ambiente do Supabase não configuradas   ║
╚══════════════════════════════════════════════════════════════╝

Para corrigir este erro, você precisa configurar as credenciais do Supabase.

OPÇÃO 1 - Arquivo .env (Recomendado):
  1. Crie um arquivo .env na raiz do projeto
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

⚠️  O app continuará funcionando, mas as funcionalidades de autenticação não estarão disponíveis.
    `.trim();
    
    console.error(errorMessage);
  }
  
  console.warn('[Supabase] Usando valores padrão. Configure as credenciais para usar o Supabase.');
  
  // Usa valores padrão para evitar crash, mas o app não funcionará corretamente
  // O AuthContext tratará a ausência de credenciais
}

// Usa valores válidos ou valores padrão para evitar crash
const finalSupabaseUrl = isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co';
const finalSupabaseAnonKey = isValidKey ? supabaseAnonKey : 'placeholder-key';

export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Tratamento de erros de refresh token será feito no AuthContext
    // Erros de rede e timeout são detectados automaticamente pelo errorHandler
  },
});

// Exporta flag para verificar se as credenciais estão configuradas
export const isSupabaseConfigured = isValidUrl && isValidKey;

// Função auxiliar para verificar se é erro de refresh token
const isInvalidRefreshTokenError = (error: any): boolean => {
  if (!error) return false;
  const errorMessage = error.message || error.toString() || '';
  return (
    errorMessage.includes('Invalid Refresh Token') ||
    errorMessage.includes('Refresh Token Not Found') ||
    errorMessage.includes('refresh_token_not_found') ||
    error?.code === 'refresh_token_not_found' ||
    (error?.name === 'AuthApiError' && errorMessage.toLowerCase().includes('refresh'))
  );
};

// Intercepta console.error para suprimir erros de refresh token inválido
// Isso evita que erros esperados apareçam no console quando o token é limpo automaticamente
if (typeof console !== 'undefined' && console.error) {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    // Converte todos os argumentos para string para verificação
    const argsString = args.map(arg => {
      if (arg && typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    // Verifica se contém erro de refresh token (case insensitive)
    const hasRefreshTokenError = 
      argsString.toLowerCase().includes('invalid refresh token') ||
      argsString.toLowerCase().includes('refresh token not found') ||
      argsString.toLowerCase().includes('refresh_token_not_found') ||
      argsString.includes('AuthApiError') && argsString.toLowerCase().includes('refresh') ||
      args.some((arg) => {
        if (arg && typeof arg === 'object') {
          return isInvalidRefreshTokenError(arg);
        }
        return false;
      });

    // Se for erro de refresh token, suprime silenciosamente
    // O AuthContext já trata esses erros adequadamente limpando os tokens
    if (hasRefreshTokenError) {
      // Apenas suprime o erro - o AuthContext já trata a limpeza de tokens
      return; // Não mostra o erro no console
    }

    // Para outros erros, mostra normalmente
    originalConsoleError(...args);
  };
}

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
