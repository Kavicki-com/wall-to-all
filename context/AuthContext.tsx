import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, clearInvalidAuthTokens, isSupabaseConfigured } from '../lib/supabase';
import { handleError } from '../lib/errorHandler';
import { AUTH_TIMEOUTS } from '../lib/constants';
import { getIsRecoverySession, getIsOAuthSignupSession } from '../lib/useDeepLinking';
import { logger } from '../lib/logger';
import { useToast } from '../components/ui/ToastProvider';

type UserRole = 'client' | 'merchant' | null;

interface AuthContextType {
  session: Session | null;
  userRole: UserRole;
  isLoading: boolean;
  isInitializing: boolean;
  profileError: string | null;
  validateSession: () => Promise<boolean>;
  refreshUserRole: (userId?: string) => Promise<UserRole>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  userRole: null,
  isLoading: true,
  isInitializing: true,
  profileError: null,
  validateSession: async () => false,
  refreshUserRole: async () => null,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fetchUserRoleRef = useRef<Promise<UserRole> | null>(null);

  // Hook de Toast para feedback visual
  const { showError } = useToast();

  // Usa a função utilitária do supabase.ts para limpar tokens
  const clearInvalidTokens = clearInvalidAuthTokens;

  const isInvalidRefreshTokenError = (error: unknown): boolean => {
    if (!error) return false;
    const errorObj = error as { message?: string; code?: string };
    const errorMessage = errorObj.message || String(error) || '';
    return (
      errorMessage.includes('Invalid Refresh Token') ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token_not_found') ||
      errorObj.code === 'refresh_token_not_found'
    );
  };

  // Função para validar se a sessão ainda é válida
  const validateSession = async (): Promise<boolean> => {
    try {
      if (!isSupabaseConfigured) {
        return false;
      }

      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearInvalidTokens();
          try {
            await supabase.auth.signOut();
          } catch {
            // Ignora erros no signOut
          }
          setSession(null);
          setUserRole(null);
          return false;
        }
        return false;
      }

      if (!currentSession) {
        setSession(null);
        setUserRole(null);
        return false;
      }

      // Verifica se a sessão expirou
      const expiresAt = currentSession.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now()) {
        // Sessão expirada, tenta refresh
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshedSession) {
          await clearInvalidTokens();
          try {
            await supabase.auth.signOut();
          } catch {
            // Ignora erros no signOut
          }
          setSession(null);
          setUserRole(null);
          return false;
        }

        setSession(refreshedSession);
        return true;
      }

      return true;
    } catch (error: unknown) {
      if (__DEV__) {
        logger.error('[AuthContext] Erro ao validar sessão:', error);
      }

      if (isInvalidRefreshTokenError(error)) {
        await clearInvalidTokens();
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignora erros no signOut
        }
        setSession(null);
        setUserRole(null);
      }

      return false;
    }
  };

  const fetchUserRole = async (userId: string): Promise<UserRole> => {
    // Previne múltiplas chamadas simultâneas
    if (fetchUserRoleRef.current) {
      return fetchUserRoleRef.current;
    }

    const fetchPromise = (async (): Promise<UserRole> => {
      try {
        // Validação de entrada
        if (!userId || typeof userId !== 'string') {
          if (__DEV__) {
            logger.warn('[AuthContext] fetchUserRole chamado com userId inválido');
          }
          return null;
        }

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout ao buscar user_role')), AUTH_TIMEOUTS.FETCH_USER_ROLE);
        });

        const fetchPromise = supabase
          .from('profiles')
          .select('user_type')
          .eq('id', userId)
          .maybeSingle();

        const result = await Promise.race([fetchPromise, timeoutPromise]);

        if (result.error) {
          // Tratamento específico para diferentes tipos de erro
          if (result.error.code === 'PGRST116') {
            // Perfil não encontrado - não é um erro crítico
            return null;
          }

          // Verifica se é erro de autenticação
          const errorMessage = result.error.message?.toLowerCase() || '';
          if (errorMessage.includes('jwt') || errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
            // Erro de autenticação - sessão pode ter expirado
            if (__DEV__) {
              logger.warn('[AuthContext] Erro de autenticação ao buscar user_role, validando sessão...');
            }
            const isValid = await validateSession();
            if (!isValid) {
              return null;
            }
            // Tenta novamente após validar sessão
            const retryResult = await supabase
              .from('profiles')
              .select('user_type')
              .eq('id', userId)
              .maybeSingle();

            if (retryResult.error && retryResult.error.code !== 'PGRST116') {
              handleError(retryResult.error, 'auth');
              return null;
            }

            if (!retryResult.data) {
              return null;
            }

            const userType = retryResult.data?.user_type as UserRole;
            setProfileError(null);
            return userType || null;
          }

          handleError(result.error, 'auth');
          return null;
        }

        if (!result.data) {
          return null;
        }

        const userType = result.data?.user_type as UserRole;
        setProfileError(null);

        return userType || null;
      } catch (error: unknown) {
        // Se for timeout, não define profileError para evitar modal durante reset de senha
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.includes('Timeout ao buscar user_role');

        if (!isTimeout) {
          // Verifica se é erro de rede ou autenticação
          const errorStr = String(error).toLowerCase();
          if (errorStr.includes('network') || errorStr.includes('fetch') || errorStr.includes('connection')) {
            if (__DEV__) {
              logger.warn('[AuthContext] Erro de rede ao buscar user_role');
            }
          } else {
            handleError(error, 'auth');
            // Não mostra toast aqui para não interromper fluxo, o log já foi feito
          }
        } else {
          // Log silencioso para timeout - não mostra erro visual
          if (__DEV__) {
            logger.warn('[AuthContext] Timeout ao buscar user_role (pode ser durante reset de senha)');
          }
        }
        return null;
      } finally {
        fetchUserRoleRef.current = null;
      }
    })();

    fetchUserRoleRef.current = fetchPromise;
    return fetchPromise;
  };

  const refreshUserRole = async (userId?: string): Promise<UserRole> => {
    const targetUserId = userId ?? session?.user?.id;

    if (!targetUserId) {
      setUserRole(null);
      return null;
    }

    const role = await fetchUserRole(targetUserId);
    setUserRole(role);
    return role;
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        setIsInitializing(true);

        if (!isSupabaseConfigured) {
          setSession(null);
          setUserRole(null);
          setIsLoading(false);
          setIsInitializing(false);
          return;
        }

        timeoutId = setTimeout(() => {
          setIsLoading(false);
          setIsInitializing(false);
          if (__DEV__) {
            logger.warn('[AuthContext] Timeout na inicialização da autenticação');
          }
        }, AUTH_TIMEOUTS.INITIALIZATION);

        let currentSession: Session | null = null;
        let sessionError: unknown = null;

        try {
          const result = await supabase.auth.getSession();
          currentSession = result.data.session;
          sessionError = result.error;
        } catch (error: unknown) {
          if (isInvalidRefreshTokenError(error)) {
            await clearInvalidTokens();
            try {
              await supabase.auth.signOut();
            } catch {
              // Ignora erros no signOut
            }
            sessionError = null;
            currentSession = null;
          } else {
            sessionError = error;
          }
        }

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (sessionError) {
          if (isInvalidRefreshTokenError(sessionError)) {
            await clearInvalidTokens();
            try {
              await supabase.auth.signOut();
            } catch {
              // Ignora erros no signOut
            }
            setSession(null);
            setUserRole(null);
            setIsLoading(false);
            setIsInitializing(false);
            return;
          }

          const processedError = handleError(sessionError, 'auth');
          showError(processedError.userMessage);
          setSession(null);
          setUserRole(null);
          setIsLoading(false);
          setIsInitializing(false);
          return;
        }

        setSession(currentSession);

        if (currentSession?.user?.id) {
          // Se for sessão de recuperação, não busca user_role (não é necessário)
          if (getIsRecoverySession()) {
            if (__DEV__) {
              logger.debug('[AuthContext] Sessão de recuperação detectada (init) - pulando busca de user_role');
            }
            setUserRole(null);
            setProfileError(null);
          } else {
            const role = await fetchUserRole(currentSession.user.id);
            setUserRole(role);

            // Só define profileError se role for null E houver um erro real (não timeout)
            // O fetchUserRole não define profileError em caso de timeout
            if (role) {
              setProfileError(null);
            } else {
              // Se role é null, pode ser timeout ou perfil não encontrado
              // Se profileError já está definido (erro real), mantém
              // Se não está definido (timeout), não define novo erro
              // Isso evita mostrar erro durante reset de senha
            }
          }
        } else {
          setUserRole(null);
          setProfileError(null);
        }
      } catch (error: unknown) {
        const processedError = handleError(error, 'auth');
        // Só mostra toast se não for erro de refresh token (que é tratado silenciosamente)
        if (!isInvalidRefreshTokenError(error)) {
          showError(processedError.userMessage);
        }

        if (isInvalidRefreshTokenError(error)) {
          try {
            await clearInvalidTokens();
          } catch (clearError) {
            if (__DEV__) {
              logger.error('[AuthContext] Erro ao limpar tokens inválidos:', clearError);
            }
          }
          try {
            await supabase.auth.signOut();
          } catch {
            // Ignora erros no signOut
          }
        }

        setSession(null);
        setUserRole(null);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      } finally {
        setIsLoading(false);
        setIsInitializing(false);
      }

      // Configura subscription APÓS a inicialização completa
      // Só cria subscription se o Supabase estiver configurado
      if (isSupabaseConfigured) {
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          try {
            if (__DEV__) {
              logger.debug('[AuthContext] onAuthStateChange:', { event, hasSession: !!newSession });
            }

            // Tratamento específico para TOKEN_REFRESHED sem sessão (refresh falhou)
            if (event === 'TOKEN_REFRESHED' && !newSession) {
              if (__DEV__) {
                logger.warn('[AuthContext] Token refresh falhou - limpando sessão');
              }
              try {
                await clearInvalidTokens();
              } catch (clearError) {
                if (__DEV__) {
                  logger.error('[AuthContext] Erro ao limpar tokens após refresh falhado:', clearError);
                }
              }
              try {
                await supabase.auth.signOut();
              } catch {
                // Ignora erros no signOut
              }
              setSession(null);
              setUserRole(null);
              setProfileError(null);
              return;
            }

            // Tratamento para SIGNED_OUT (logout forçado por token expirado ou inválido)
            if (event === 'SIGNED_OUT') {
              if (__DEV__) {
                logger.debug('[AuthContext] Usuário deslogado (SIGNED_OUT)');
              }
              try {
                await clearInvalidTokens();
              } catch (clearError) {
                if (__DEV__) {
                  logger.error('[AuthContext] Erro ao limpar tokens após SIGNED_OUT:', clearError);
                }
              }
              setSession(null);
              setUserRole(null);
              setProfileError(null);
              return;
            }

            // Validação de tipo antes de acessar propriedades
            if (newSession && typeof newSession === 'object' && 'user' in newSession) {
              setSession(newSession);

              // Validação adicional: verifica se user.id existe e é string válida
              const userId = newSession.user?.id;
              if (userId && typeof userId === 'string' && userId.length > 0) {
                // Verifica se é OAuth Google - se for, pula busca de user_role
                // O useAuthRouting vai verificar o perfil e redirecionar diretamente
                const isGoogleProvider = newSession.user?.app_metadata?.provider === 'google';

                // Se for sessão de recuperação OU signup OAuth novo OU provider Google, não busca user_role
                if (getIsRecoverySession() || getIsOAuthSignupSession() || isGoogleProvider) {
                  if (__DEV__) {
                    const sessionType = getIsRecoverySession()
                      ? 'recuperação'
                      : isGoogleProvider
                        ? 'Google OAuth'
                        : 'signup OAuth';
                    logger.debug(`[AuthContext] Sessão de ${sessionType} detectada - pulando busca de user_role (useAuthRouting fará redirecionamento)`);
                  }
                  setUserRole(null);
                  setProfileError(null);
                } else {
                  try {
                    // Busca user_role normalmente para sessões regulares
                    const role = await fetchUserRole(userId);
                    setUserRole(role);

                    // Só define profileError se role for null E houver um erro real (não timeout)
                    // O fetchUserRole não define profileError em caso de timeout
                    if (role) {
                      setProfileError(null);
                    } else {
                      // Se role é null, pode ser timeout ou perfil não encontrado
                      // Se profileError já está definido (erro real), mantém
                      // Se não está definido (timeout), não define novo erro
                      // Isso evita mostrar erro durante reset de senha
                    }
                  } catch (fetchError: unknown) {
                    // Erro ao buscar user_role - não deve quebrar o fluxo
                    if (__DEV__) {
                      logger.error('[AuthContext] Erro ao buscar user_role no onAuthStateChange:', fetchError);
                    }
                    const processedError = handleError(fetchError, 'auth');
                    // Não mostra toast aqui para user_role, pois não impede uso do app
                    setUserRole(null);
                  }
                }
              } else {
                // Sessão sem userId válido
                if (__DEV__) {
                  logger.warn('[AuthContext] Sessão sem userId válido');
                }
                setUserRole(null);
                setProfileError(null);
              }
            } else {
              // newSession é null ou inválido
              setSession(null);
              setUserRole(null);
              setProfileError(null);
            }
          } catch (error: unknown) {
            // Try/catch externo para capturar qualquer erro não tratado
            if (__DEV__) {
              logger.error('[AuthContext] Erro não tratado no onAuthStateChange:', error);
            }
            handleError(error, 'auth');

            if (isInvalidRefreshTokenError(error)) {
              try {
                await clearInvalidTokens();
              } catch (clearError) {
                if (__DEV__) {
                  logger.error('[AuthContext] Erro ao limpar tokens após erro no onAuthStateChange:', clearError);
                }
              }
              try {
                await supabase.auth.signOut();
              } catch {
                // Ignora erros no signOut
              }
              setSession(null);
              setUserRole(null);
              setProfileError(null);
            }
          }
        });

        subscription = authSubscription;
      }
    };

    // Inicia a autenticação
    initializeAuth().catch(error => {
      if (__DEV__) {
        logger.error('[AuthContext] Erro não capturado em initializeAuth:', error);
      }
      const processedError = handleError(error, 'auth');
      showError(processedError.userMessage);
      setIsLoading(false);
      setIsInitializing(false);
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // clearInvalidTokens é estável (função importada), não precisa estar nas dependências
  }, []);

  const value: AuthContextType = {
    session,
    userRole,
    isLoading,
    isInitializing,
    profileError,
    validateSession,
    refreshUserRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

