import { supabase, isSupabaseConfigured } from './supabase';

// Flag para indicar que estamos em uma sessão de recuperação de senha
// Isso permite pular a busca de user_role durante o reset de senha
let isRecoverySession = false;
let recoverySessionTimeout: NodeJS.Timeout | null = null;

export const setIsRecoverySession = (value: boolean) => {
  isRecoverySession = value;
  
  // Limpa timeout anterior se existir
  if (recoverySessionTimeout) {
    clearTimeout(recoverySessionTimeout);
  }
  
  // Limpa a flag após 5 minutos (tempo suficiente para completar o reset)
  if (value) {
    recoverySessionTimeout = setTimeout(() => {
      isRecoverySession = false;
      recoverySessionTimeout = null;
    }, 5 * 60 * 1000);
  } else {
    recoverySessionTimeout = null;
  }
};

export const getIsRecoverySession = (): boolean => {
  return isRecoverySession;
};

/**
 * Extrai os parâmetros de autenticação do fragmento (#) da URL
 * O Supabase envia tokens no formato: walltoall://reset-password#access_token=xxx&refresh_token=xxx&type=recovery
 */
export const extractAuthParams = (url: string): Record<string, string> | null => {
  try {
    // Procura por fragmento (#) na URL
    const hashIndex = url.indexOf('#');
    console.log('[DeepLinking] extractAuthParams - hashIndex:', hashIndex, 'url length:', url.length);
    if (hashIndex === -1) {
      console.log('[DeepLinking] extractAuthParams - Nenhum hash encontrado na URL');
      return null;
    }

    // Decodifica o fragment para tratar %26 como &
    const fragment = decodeURIComponent(url.substring(hashIndex + 1));
    console.log('[DeepLinking] extractAuthParams - Fragment decodificado (primeiros 100 chars):', fragment.substring(0, 100));
    const params: Record<string, string> = {};

    // Parse dos parâmetros do fragmento
    const pairs = fragment.split('&');
    console.log('[DeepLinking] extractAuthParams - Número de pares encontrados:', pairs.length);
    pairs.forEach((pair, index) => {
      const [key, value] = pair.split('=');
      if (key && value) {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = decodeURIComponent(value);
        params[decodedKey] = decodedValue;
        if (index < 3) { // Log apenas os primeiros 3 para não poluir
          console.log(`[DeepLinking] extractAuthParams - Par ${index}: ${decodedKey} = ${decodedValue.substring(0, 50)}...`);
        }
      }
    });

    console.log('[DeepLinking] extractAuthParams - Params extraídos:', {
      keys: Object.keys(params),
      hasAccessToken: !!params.access_token,
      hasRefreshToken: !!params.refresh_token,
      hasType: !!params.type,
    });

    // Verifica se tem os tokens necessários
    if (params.access_token && params.refresh_token) {
      return params;
    }

    console.log('[DeepLinking] extractAuthParams - Faltando tokens! access_token:', !!params.access_token, 'refresh_token:', !!params.refresh_token);
    return null;
  } catch (error) {
    console.error('[DeepLinking] Erro ao extrair parâmetros:', error);
    return null;
  }
};

/**
 * Processa os tokens de autenticação da URL e configura a sessão no Supabase
 * Retorna true se a sessão foi configurada com sucesso
 */
export const processAuthTokensFromUrl = async (url: string): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    console.log('[DeepLinking] Supabase não configurado');
    return false;
  }

  console.log('[DeepLinking] Processando URL:', url);

  const params = extractAuthParams(url);
  if (!params) {
    console.log('[DeepLinking] Nenhum token de autenticação encontrado na URL');
    return false;
  }

  console.log('[DeepLinking] Params extraídos:', {
    hasAccessToken: !!params.access_token,
    hasRefreshToken: !!params.refresh_token,
    accessTokenLength: params.access_token?.length,
    refreshTokenLength: params.refresh_token?.length,
    type: params.type,
  });

  try {
    console.log('[DeepLinking] Configurando sessão com tokens...');
    console.log('[DeepLinking] Tipo:', params.type);

    // Se for uma sessão de recuperação, define a flag para pular busca de user_role
    if (params.type === 'recovery') {
      setIsRecoverySession(true);
      console.log('[DeepLinking] Sessão de recuperação detectada - pulando busca de user_role');
    }

    // Configura a sessão com os tokens do link
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    console.log('[DeepLinking] Resultado setSession:', {
      hasData: !!data,
      hasSession: !!data?.session,
      hasUser: !!data?.session?.user,
      error: error?.message,
      errorCode: error?.code,
      errorStatus: error?.status,
    });

    if (error) {
      console.error('[DeepLinking] Erro ao configurar sessão:', error);
      console.error('[DeepLinking] Detalhes do erro:', {
        message: error.message,
        code: error.code,
        status: error.status,
        name: error.name,
      });
      return false;
    }

    console.log('[DeepLinking] Sessão configurada com sucesso!');
    console.log('[DeepLinking] Usuário:', data.session?.user?.email);

    return true;
  } catch (error: any) {
    console.error('[DeepLinking] Exceção ao processar tokens:', error);
    console.error('[DeepLinking] Detalhes da exceção:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return false;
  }
};
