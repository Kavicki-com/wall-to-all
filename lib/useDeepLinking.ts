import { supabase, isSupabaseConfigured } from './supabase';
import { logger } from '../lib/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

// Flag para indicar que estamos em uma sessão de recuperação de senha
// Isso permite pular a busca de user_role durante o reset de senha
let isRecoverySession = false;
let recoverySessionTimeout: NodeJS.Timeout | null = null;

// Flag para indicar que estamos em um signup via OAuth (Google)
// Isso permite pular a busca de user_role (que não existirá para novos usuários)
let isOAuthSignupSession = false;
let oauthSignupSessionTimeout: NodeJS.Timeout | null = null;

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

export const setIsOAuthSignupSession = (value: boolean) => {
  isOAuthSignupSession = value;

  // Limpa timeout anterior se existir
  if (oauthSignupSessionTimeout) {
    clearTimeout(oauthSignupSessionTimeout);
  }

  // Limpa a flag após 10 minutos (tempo suficiente para completar o signup)
  if (value) {
    oauthSignupSessionTimeout = setTimeout(() => {
      isOAuthSignupSession = false;
      oauthSignupSessionTimeout = null;
    }, 10 * 60 * 1000);
  } else {
    oauthSignupSessionTimeout = null;
  }
};

export const getIsOAuthSignupSession = (): boolean => {
  return isOAuthSignupSession;
};

// Flag para indicar que o callback (app/auth/callback.tsx) já processou a URL
// Isso evita double processing com useDeepLinkHandler
let callbackProcessed = false;

export const setCallbackProcessed = (value: boolean) => {
  callbackProcessed = value;
  if (__DEV__) {
    logger.debug('[useDeepLinking] callbackProcessed:', value);
  }
};

export const getCallbackProcessed = (): boolean => {
  return callbackProcessed;
};

/**
 * Salva o código de referral se presente na URL
 * Suporta formatos: ?ref=CODE ou ?referral=CODE
 */
export const extractAndSaveReferralCode = async (url: string, isInitialUrl = false): Promise<string | null> => {
  try {
    const { queryParams } = Linking.parse(url);
    const refCode = queryParams?.ref || queryParams?.referral;

    if (refCode && typeof refCode === 'string') {
      const upperRefCode = refCode.toUpperCase();

      // Se for URL inicial, verificar se é o mesmo código que acabou de ser usado
      // Isso evita que o código "volte das cinzas" por persistência do getInitialURL
      if (isInitialUrl) {
        const lastUsed = await AsyncStorage.getItem('last_used_referral_code');
        if (lastUsed === upperRefCode) {
          if (__DEV__) {
            logger.debug('[DeepLinking] Referral code ignorado (sticky initial URL):', upperRefCode);
          }
          return null;
        }
      }

      await AsyncStorage.setItem('referral_code', upperRefCode);
      if (__DEV__) {
        logger.debug('[DeepLinking] Referral code salvo:', refCode);
      }
      return refCode;
    }
  } catch (error) {
    logger.warn('[DeepLinking] Erro ao extrair referral code:', error);
  }
  return null;
};

/**
 * Extrai os parâmetros de autenticação do fragmento (#) da URL
 * O Supabase envia tokens no formato: walltoall://reset-password#access_token=xxx&refresh_token=xxx&type=recovery
 */
export const extractAuthParams = (url: string): Record<string, string | boolean> | null => {
  try {
    if (__DEV__) {
      logger.debug('[DeepLinking] extractAuthParams - Iniciando extração');
      logger.debug('[DeepLinking] extractAuthParams - URL length:', url.length);
    }

    // Procura por fragmento (#) na URL
    const hashIndex = url.indexOf('#');
    if (__DEV__) {
      logger.debug('[DeepLinking] extractAuthParams - hashIndex:', hashIndex);
    }

    if (hashIndex === -1) {
      if (__DEV__) {
        logger.warn('[DeepLinking] extractAuthParams - ✗ Nenhum hash (#) encontrado na URL');
      }
      return null;
    }

    // Decodifica o fragment para tratar %26 como &
    const fragment = decodeURIComponent(url.substring(hashIndex + 1));
    if (__DEV__) {
      logger.debug('[DeepLinking] extractAuthParams - Fragment decodificado (primeiros 100 chars):', fragment.substring(0, 100));
    }
    const params: Record<string, string> = {};

    // Parse dos parâmetros do fragmento
    const pairs = fragment.split('&');
    if (__DEV__) {
      logger.debug('[DeepLinking] extractAuthParams - Número de pares encontrados:', pairs.length);
    }
    pairs.forEach((pair, index) => {
      const [key, value] = pair.split('=');
      if (key && value) {
        const decodedKey = decodeURIComponent(key);
        const decodedValue = decodeURIComponent(value);
        params[decodedKey] = decodedValue;
        if (__DEV__ && index < 3) { // Log apenas os primeiros 3 para não poluir
          logger.debug(`[DeepLinking] extractAuthParams - Par ${index}: ${decodedKey} = ${decodedValue.substring(0, 50)}...`);
        }
      }
    });

    if (__DEV__) {
      logger.debug('[DeepLinking] extractAuthParams - Params extraídos:', {
        keys: Object.keys(params),
        hasAccessToken: !!params.access_token,
        hasRefreshToken: !!params.refresh_token,
        hasType: !!params.type,
        hasError: !!params.error,
        errorCode: params.error_code,
      });
    }

    // Verifica se a URL contém erros do Supabase (link expirado/inválido)
    if (params.error || params.error_code) {
      if (__DEV__) {
        logger.error('[DeepLinking] extractAuthParams - ✗ URL contém erro do Supabase:', {
          error: params.error,
          errorCode: params.error_code,
          errorDescription: params.error_description,
        });
      }
      // Retorna um objeto especial indicando erro
      return { __error: true, error: params.error, error_code: params.error_code, error_description: params.error_description };
    }

    // Verifica se tem os tokens necessários
    if (params.access_token && params.refresh_token) {
      if (__DEV__) {
        logger.debug('[DeepLinking] extractAuthParams - ✓ Tokens extraídos com sucesso!', {
          hasAccessToken: true,
          hasRefreshToken: true,
          hasType: !!params.type,
          type: params.type,
        });
      }
      return params;
    }

    if (__DEV__) {
      logger.error('[DeepLinking] extractAuthParams - ✗ Faltando tokens!', {
        hasAccessToken: !!params.access_token,
        hasRefreshToken: !!params.refresh_token,
        foundKeys: Object.keys(params),
      });
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      logger.error('[DeepLinking] Erro ao extrair parâmetros:', error);
    }
    return null;
  }
};

/**
 * Processa os tokens de autenticação da URL e configura a sessão no Supabase
 * Retorna true se a sessão foi configurada com sucesso
 */
let processingPromise: Promise<boolean> | null = null; // Promise-based lock

export const processAuthTokensFromUrl = async (url: string): Promise<boolean> => {
  // Se já existe um processamento em andamento, aguarda e retorna o resultado dele
  if (processingPromise) {
    if (__DEV__) {
      logger.debug('[DeepLinking] processAuthTokensFromUrl já está em execução, aguardando resultado...');
    }
    return processingPromise;
  }

  // Cria a Promise e a armazena para que chamadas subsequentes aguardem
  processingPromise = (async (): Promise<boolean> => {
    try {
      if (__DEV__) {
        logger.debug('[DeepLinking] ========== processAuthTokensFromUrl CHAMADO ==========');
        logger.debug('[DEBUG] processAuthTokensFromUrl URL:', url.substring(0, 100));
      }

      if (!isSupabaseConfigured) {
        if (__DEV__) {
          logger.error('[DeepLinking] Supabase não configurado!');
        }
        return false;
      }

      if (__DEV__) {
        logger.debug('[DeepLinking] === PROCESSANDO TOKENS DA URL ===');
        logger.debug('[DeepLinking] URL (primeiros 100 chars):', url.substring(0, 100) + '...');
      }

      const params = extractAuthParams(url);
      if (!params) {
        if (__DEV__) {
          logger.warn('[DeepLinking] ✗ Nenhum token de autenticação encontrado na URL');
        }
        return false;
      }

      // Verifica se a URL contém erro do Supabase
      if (params.__error) {
        logger.error('[DeepLinking] URL contém erro do Supabase:', {
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
      // provider_token só existe em logins OAuth (Google, etc.)
      const providerToken = typeof params.provider_token === 'string' ? params.provider_token : null;
      const hasOAuthProviderToken = providerToken !== null && providerToken.length > 0;

      if (__DEV__) {
        logger.debug('[DeepLinking] Params extraídos:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenLength: accessToken?.length,
          refreshTokenLength: refreshToken?.length,
          type: type,
          hasProviderToken: hasOAuthProviderToken, // Indica que é OAuth
        });
      }

      try {
        if (__DEV__) {
          logger.debug('[DeepLinking] Configurando sessão com tokens...');
          logger.debug('[DeepLinking] Tipo de sessão:', type || 'normal');
          logger.debug('[DeepLinking] Access token length:', accessToken?.length);
          logger.debug('[DeepLinking] Refresh token length:', refreshToken?.length);
        }

        // Se for uma sessão de recuperação, define a flag para pular busca de user_role
        if (type === 'recovery') {
          setIsRecoverySession(true);
          if (__DEV__) {
            logger.debug('[DeepLinking] ✓ Sessão de RECUPERAÇÃO detectada - pulando busca de user_role');
          }
        } else {
          if (__DEV__) {
            logger.debug('[DeepLinking] Sessão normal (não é recovery)');
          }
        }

        // Configura a sessão com os tokens do link
        if (!accessToken || !refreshToken) {
          if (__DEV__) {
            logger.error('[DeepLinking] ✗ Tokens inválidos ou ausentes:', {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
            });
          }
          return false;
        }

        // IMPORTANTE: Limpar flags OAuth antigas ANTES de qualquer coisa
        // Isso evita race condition onde useAuthRouting lê flags antigas enquanto
        // processamos o novo login e verificamos se é usuário novo ou existente
        try {
          await AsyncStorage.removeItem('oauth_google_signup');
          await AsyncStorage.removeItem('oauth_google_data');
          setIsOAuthSignupSession(false);
          if (__DEV__) {
            logger.debug('[DeepLinking] Flags OAuth antigas limpas antes de processar login');
          }
        } catch (clearError) {
          if (__DEV__) {
            logger.warn('[DeepLinking] Erro ao limpar flags OAuth antigas:', clearError);
          }
        }

        // IMPORTANTE: Detectar OAuth Google e salvar dados ANTES de setSession
        // Isso evita race condition onde onAuthStateChange dispara antes dos dados serem salvos
        // NOTA: Aqui apenas salvamos os dados do OAuth temporariamente.
        // A decisão de tratar como signup ou login será feita APÓS setSession,
        // quando teremos sessão para verificar se o perfil já existe.
        let isGoogleOAuth = false;
        let googleOAuthData: { full_name: string; email: string; avatar_url: string | null; user_id: string } | null = null;

        try {
          // Decodifica o JWT para extrair informações do usuário
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            const provider = payload.app_metadata?.provider;
            const userId = payload.sub;

            // Detecta OAuth Google de duas formas:
            // 1. provider === 'google' no JWT (conta criada via Google)
            // 2. hasOAuthProviderToken === true (login via Google em conta criada via email)
            if (provider === 'google' || hasOAuthProviderToken) {
              isGoogleOAuth = true;

              if (__DEV__) {
                const detectionMethod = provider === 'google' ? 'provider no JWT' : 'provider_token na URL';
                logger.debug(`[DeepLinking] OAuth Google detectado via ${detectionMethod}, salvando dados temporários`);
              }

              // Salvar dados do Google temporariamente para usar depois
              googleOAuthData = {
                full_name: payload.user_metadata?.full_name || payload.user_metadata?.name || '',
                email: payload.email || '',
                avatar_url: payload.user_metadata?.avatar_url || payload.user_metadata?.picture || null,
                user_id: userId,
              };
            }
          }
        } catch (decodeError) {
          if (__DEV__) {
            logger.warn('[DeepLinking] Não foi possível decodificar JWT para extrair dados OAuth:', decodeError);
          }
          // Não bloqueia o fluxo, os dados serão salvos após setSession como fallback
        }

        // IMPORTANTE: Se detectamos OAuth, definir flag ANTES de setSession
        // Isso evita que o AuthContext tente buscar user_role e dê timeout
        // A flag será limpa após verificar o perfil
        if (isGoogleOAuth) {
          setIsOAuthSignupSession(true);
          if (__DEV__) {
            logger.debug('[DeepLinking] Flag OAuth definida antes de setSession (será verificada após)');
          }
        }

        if (__DEV__) {
          logger.debug('[DeepLinking] Chamando setSession...');
        }
        if (__DEV__) {
          logger.debug('[DeepLinking] ========== CHAMANDO setSession ==========');
          logger.debug('[DEBUG] setSession - isRecovery:', type === 'recovery');
          logger.debug('[DEBUG] setSession - accessToken length:', accessToken?.length);
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (__DEV__) {
          logger.debug('[DeepLinking] ========== setSession RESULTADO ==========');
          logger.debug('[DEBUG] setSession resultado - hasError:', !!error);
          logger.debug('[DEBUG] setSession resultado - hasSession:', !!data?.session);
          logger.debug('[DEBUG] setSession resultado - error:', error?.message);
          if (error) {
            logger.error('[DEBUG] setSession ERRO:', error);
          }
        }

        if (__DEV__) {
          logger.debug('[DeepLinking] Resultado setSession:', {
            hasData: !!data,
            hasSession: !!data?.session,
            hasUser: !!data?.session?.user,
            userEmail: data?.session?.user?.email,
            error: error?.message,
            errorCode: error?.code,
            errorStatus: error?.status,
            isRecovery: type === 'recovery',
          });
        }

        if (error) {
          if (__DEV__) {
            logger.error('[DeepLinking] ✗ Erro ao configurar sessão:', error);
            logger.error('[DeepLinking] Detalhes do erro:', {
              message: error.message,
              code: error.code,
              status: error.status,
              name: error.name,
            });
          }
          return false;
        }

        if (!data?.session) {
          if (__DEV__) {
            logger.error('[DeepLinking] ✗ setSession retornou sem erro mas sem sessão!');
          }
          return false;
        }

        if (__DEV__) {
          logger.debug('[DeepLinking] ✓ Sessão configurada com sucesso!');
          logger.debug('[DeepLinking] Email:', data.session.user?.email);
          logger.debug('[DeepLinking] User ID:', data.session.user?.id);
        }

        // Verifica se a sessão foi realmente persistida após setSession
        // Em produção, pode haver um delay na persistência
        const verifySession = async () => {
          const { data: { session: verifiedSession }, error: verifyError } = await supabase.auth.getSession();
          if (verifyError) {
            logger.error('[DeepLinking] Erro ao verificar sessão após setSession:', verifyError);
            return false;
          }
          if (!verifiedSession) {
            if (__DEV__) {
              logger.warn('[DeepLinking] Sessão não encontrada após setSession - pode haver delay na persistência');
            }
            // Aguarda um pouco e tenta novamente
            await new Promise(resolve => setTimeout(resolve, 500));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (!retrySession) {
              logger.error('[DeepLinking] Sessão ainda não encontrada após retry');
              return false;
            }
            if (__DEV__) {
              logger.debug('[DeepLinking] Sessão encontrada após retry');
            }
          }
          return true;
        };

        const sessionPersisted = await verifySession();
        if (!sessionPersisted) {
          if (__DEV__) {
            logger.error('[DeepLinking] ✗ Sessão não foi persistida corretamente');
          }
          return false;
        }

        if (__DEV__) {
          logger.debug('[DeepLinking] ✓ Sessão persistida e verificada com sucesso!');
        }

        // IMPORTANTE: Agora que temos sessão, verificamos se é OAuth Google e se o perfil já existe
        // Isso decide se tratamos como login normal ou como novo signup
        if (data?.session?.user) {
          const user = data.session.user;
          const provider = user.app_metadata?.provider;

          // Usa os dados pré-processados ou detecta do objeto user
          const effectiveIsGoogleOAuth = isGoogleOAuth || provider === 'google';
          const effectiveOAuthData = googleOAuthData || (provider === 'google' ? {
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
            email: user.email || '',
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            user_id: user.id,
          } : null);

          if (effectiveIsGoogleOAuth && effectiveOAuthData) {
            if (__DEV__) {
              logger.debug('[DeepLinking] OAuth Google detectado, verificando se é usuário existente...');
            }

            // Verifica se já existe um perfil completo para este usuário
            let isExistingUser = false;
            try {
              const { data: existingProfile, error: profileError } = await supabase
                .from('profiles')
                .select('id, signup_complete, user_type')
                .eq('id', user.id)
                .maybeSingle();

              if (__DEV__) {
                logger.debug('[DeepLinking] Resultado da verificação de perfil:', {
                  userId: user.id,
                  hasProfile: !!existingProfile,
                  signupComplete: existingProfile?.signup_complete,
                  userType: existingProfile?.user_type,
                  error: profileError?.message,
                });
              }

              if (!profileError && existingProfile && existingProfile.signup_complete === true) {
                isExistingUser = true;
                if (__DEV__) {
                  logger.debug('[DeepLinking] ✓ Perfil existente com signup_complete=true encontrado - LOGIN NORMAL', {
                    userId: user.id,
                    user_type: existingProfile.user_type,
                  });
                }
              }
            } catch (checkError) {
              if (__DEV__) {
                logger.warn('[DeepLinking] Erro ao verificar perfil existente:', checkError);
              }
              // Em caso de erro, assume novo usuário para ser seguro
            }

            if (isExistingUser) {
              // USUÁRIO EXISTENTE: Limpa flags e permite login normal
              // O AuthContext vai buscar o user_role e redirecionar para a home correta
              await AsyncStorage.removeItem('oauth_google_signup');
              await AsyncStorage.removeItem('oauth_google_data');
              setIsOAuthSignupSession(false);

              if (__DEV__) {
                logger.debug('[DeepLinking] Flags OAuth limpas - AuthContext fará login normal');
              }
            } else {
              // NOVO USUÁRIO: Define flags para fluxo de signup
              setIsOAuthSignupSession(true);

              try {
                await AsyncStorage.setItem('oauth_google_signup', 'true');
                const oauthDataToSave = {
                  ...effectiveOAuthData,
                  provider: 'google',
                };
                await AsyncStorage.setItem('oauth_google_data', JSON.stringify(oauthDataToSave));

                if (__DEV__) {
                  logger.debug('[DeepLinking] ✓ Novo usuário OAuth - flags definidas para signup:', {
                    full_name: oauthDataToSave.full_name,
                    email: oauthDataToSave.email,
                    has_avatar: !!oauthDataToSave.avatar_url,
                  });
                }
              } catch (storageError) {
                logger.error('[DeepLinking] Erro ao salvar dados OAuth no AsyncStorage:', storageError);
              }
            }
          }
        }

        if (__DEV__) {
          logger.debug('[DeepLinking] === PROCESSAMENTO DE TOKENS CONCLUÍDO COM SUCESSO ===');
        }
        return true;
      } catch (error: unknown) {
        if (__DEV__) {
          logger.error('[DeepLinking] ✗ Exceção ao processar tokens:', error);
          if (error && typeof error === 'object') {
            logger.error('[DeepLinking] Detalhes da exceção:', {
              message: 'message' in error ? error.message : undefined,
              code: 'code' in error ? error.code : undefined,
              stack: 'stack' in error ? error.stack : undefined,
            });
          }
        }
        return false;
      }
    } finally {
      // Reset da Promise para permitir novas chamadas futuras
      processingPromise = null;
    }
  })();

  // Retorna a Promise armazenada (não a variável global que será resetada)
  const result = processingPromise;
  return result!;
};
