import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, clearInvalidAuthTokens, isSupabaseConfigured } from '../lib/supabase';
import { handleError } from '../lib/errorHandler';
import { AUTH_TIMEOUTS } from '../lib/constants';
import { getIsRecoverySession } from '../lib/useDeepLinking';
import { logger } from '../lib/logger';

type UserRole = 'client' | 'merchant' | null;

interface AuthContextType {
  session: Session | null;
  userRole: UserRole;
  isLoading: boolean;
  profileError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  userRole: null,
  isLoading: true,
  profileError: null,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

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

  const fetchUserRole = async (userId: string): Promise<UserRole> => {
    try {
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
        if (result.error.code !== 'PGRST116') {
          handleError(result.error, 'auth');
        }
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
        handleError(error, 'auth');
      } else {
        // Log silencioso para timeout - não mostra erro visual
        if (__DEV__) {
          logger.warn('[AuthContext] Timeout ao buscar user_role (pode ser durante reset de senha)');
        }
      }
      return null;
    }
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        if (!isSupabaseConfigured) {
          setSession(null);
          setUserRole(null);
          setIsLoading(false);
          return;
        }

        timeoutId = setTimeout(() => {
          setIsLoading(false);
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
            return;
          }
          
          handleError(sessionError, 'auth');
          setSession(null);
          setUserRole(null);
          setIsLoading(false);
          return;
        }

        setSession(currentSession);

        if (currentSession?.user?.id) {
          // Se for sessão de recuperação, não busca user_role (não é necessário)
          if (getIsRecoverySession()) {
            if (__DEV__) { logger.debug('[AuthContext] Sessão de recuperação detectada (init) - pulando busca de user_role');
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
        handleError(error, 'auth');
        
        if (isInvalidRefreshTokenError(error)) {
          await clearInvalidTokens();
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
      }
    };

    try {
      initializeAuth();

      // Só cria subscription se o Supabase estiver configurado
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        // #region agent log
        try { fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:224',message:'onAuthStateChange evento',data:{event,hasSession:!!newSession,userEmail:newSession?.user?.email,isRecovery:getIsRecoverySession()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{}); } catch(e) {}
        // #endregion
        
        try {
          if (event === 'TOKEN_REFRESHED' && !newSession) {
            await clearInvalidTokens();
            setSession(null);
            setUserRole(null);
            setProfileError(null);
            return;
          }

          setSession(newSession);
          
          // #region agent log
          try { fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.tsx:236',message:'setSession chamado no AuthContext',data:{event,hasSession:!!newSession,userEmail:newSession?.user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{}); } catch(e) {}
          // #endregion

          if (newSession?.user?.id) {
            // Se for sessão de recuperação, não busca user_role (não é necessário)
            if (getIsRecoverySession()) {
              if (__DEV__) { logger.debug('[AuthContext] Sessão de recuperação detectada - pulando busca de user_role');
              }
              setUserRole(null);
              setProfileError(null);
            } else {
              // Busca user_role normalmente para sessões regulares
              const role = await fetchUserRole(newSession.user.id);
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
          handleError(error, 'auth');
          
          if (isInvalidRefreshTokenError(error)) {
            await clearInvalidTokens();
            setSession(null);
            setUserRole(null);
            setProfileError(null);
          }
        }
      });

      subscription = authSubscription;
    } catch (error) {
      handleError(error, 'auth');
      setIsLoading(false);
    }

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
    profileError,
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

