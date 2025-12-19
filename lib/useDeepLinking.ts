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
export const extractAuthParams = (url: string): Record<string, string | boolean> | null => {
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
      hasError: !!params.error,
      errorCode: params.error_code,
    });

    // Verifica se a URL contém erros do Supabase (link expirado/inválido)
    if (params.error || params.error_code) {
      console.log('[DeepLinking] extractAuthParams - URL contém erro do Supabase:', {
        error: params.error,
        errorCode: params.error_code,
        errorDescription: params.error_description,
      });
      // Retorna um objeto especial indicando erro
      return { __error: true, error: params.error, error_code: params.error_code, error_description: params.error_description };
    }

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

  // Verifica se a URL contém erro do Supabase
  if (params.__error) {
    console.error('[DeepLinking] URL contém erro do Supabase:', {
      error: params.error,
      error_code: params.error_code,
      error_description: params.error_description,
    });
    // Retorna um erro específico que será tratado pelo componente
    throw new Error(`SUPABASE_ERROR:${params.error_code || params.error}:${params.error_description || 'Link inválido ou expirado'}`);
  }

  // Type guard: após verificar que não há erro, garantimos que access_token e refresh_token são strings
  const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
  const type = typeof params.type === 'string' ? params.type : undefined;

  console.log('[DeepLinking] Params extraídos:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    accessTokenLength: accessToken?.length,
    refreshTokenLength: refreshToken?.length,
    type: type,
  });

  try {
    console.log('[DeepLinking] Configurando sessão com tokens...');
    console.log('[DeepLinking] Tipo:', type);

    // Se for uma sessão de recuperação, define a flag para pular busca de user_role
    if (type === 'recovery') {
      setIsRecoverySession(true);
      console.log('[DeepLinking] Sessão de recuperação detectada - pulando busca de user_role');
      
      // Limpa qualquer sessão anterior antes de configurar a nova sessão de recovery
      // Isso evita conflitos quando o app está aberto e um novo link é processado
      // IMPORTANTE: Sempre faz signOut antes de processar recovery, mesmo que não detecte sessão
      // porque o Supabase pode ter uma sessão em cache que não é retornada por getSession()
      try {
        const { data: currentSession, error: sessionError } = await supabase.auth.getSession();
        
        // Sempre faz signOut antes de processar recovery, mesmo se não detectar sessão
        // Isso garante que não há sessão em cache interferindo
        console.log('[DeepLinking] Limpando sessão anterior antes de processar link de recovery...');
        await supabase.auth.signOut();
        // Aguarda um pouco para garantir que a limpeza foi processada
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (cleanupError) {
        console.warn('[DeepLinking] Erro ao limpar sessão anterior (pode não existir):', cleanupError);
        // Continua mesmo se a limpeza falhar
      }
    }

    // Configura a sessão com os tokens do link
    if (!accessToken || !refreshToken) {
      console.error('[DeepLinking] Tokens inválidos ou ausentes');
      return false;
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
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

    // Verifica se a sessão foi realmente persistida após setSession
    // Em produção, pode haver um delay na persistência
    const verifySession = async () => {
      const { data: { session: verifiedSession }, error: verifyError } = await supabase.auth.getSession();
      if (verifyError) {
        console.error('[DeepLinking] Erro ao verificar sessão após setSession:', verifyError);
        return false;
      }
      if (!verifiedSession) {
        console.warn('[DeepLinking] Sessão não encontrada após setSession - pode haver delay na persistência');
        // Aguarda um pouco e tenta novamente
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (!retrySession) {
          console.error('[DeepLinking] Sessão ainda não encontrada após retry');
          return false;
        }
        console.log('[DeepLinking] Sessão encontrada após retry');
      }
      return true;
    };

    const sessionPersisted = await verifySession();
    if (!sessionPersisted) {
      console.error('[DeepLinking] Sessão não foi persistida corretamente');
      return false;
    }

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
