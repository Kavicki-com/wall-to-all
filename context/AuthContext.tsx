import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, clearInvalidAuthTokens } from '../lib/supabase';

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

  // Verifica se o erro é relacionado a refresh token inválido
  const isInvalidRefreshTokenError = (error: any): boolean => {
    if (!error) return false;
    const errorMessage = error.message || error.toString() || '';
    return (
      errorMessage.includes('Invalid Refresh Token') ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token_not_found') ||
      error.code === 'refresh_token_not_found'
    );
  };

  const fetchUserRole = async (userId: string): Promise<UserRole> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('[AuthContext] Erro ao buscar user_type:', error);
        }
        return null;
      }

      if (!data) {
        console.warn('[AuthContext] Perfil não encontrado na tabela profiles. UserId:', userId);
        return null;
      }

      const userType = data?.user_type as UserRole;
      setProfileError(null);
      
      return userType || null;
    } catch (error) {
      console.error('[AuthContext] Erro ao buscar role do usuário:', error);
      return null;
    }
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Timeout de segurança: garante que isLoading não fique travado
        timeoutId = setTimeout(() => {
          console.warn('[AuthContext] Timeout na inicialização - forçando isLoading = false');
          setIsLoading(false);
        }, 5000);

        let currentSession: Session | null = null;
        let sessionError: any = null;

        try {
          const result = await supabase.auth.getSession();
          currentSession = result.data.session;
          sessionError = result.error;
        } catch (error: any) {
          // Captura erros não tratados, especialmente refresh token inválido
          if (isInvalidRefreshTokenError(error)) {
            console.warn('[AuthContext] Refresh token inválido detectado, limpando tokens...');
            await clearInvalidTokens();
            // Tentar fazer signOut para limpar completamente
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              // Ignora erros no signOut
            }
            sessionError = null; // Tratar como se não houvesse sessão
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
          // Se for erro de refresh token inválido, limpar e continuar sem sessão
          if (isInvalidRefreshTokenError(sessionError)) {
            console.warn('[AuthContext] Refresh token inválido no getSession, limpando...');
            await clearInvalidTokens();
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              // Ignora erros no signOut
            }
            setSession(null);
            setUserRole(null);
            setIsLoading(false);
            return;
          }
          
          console.error('Erro ao buscar sessão:', sessionError);
          setSession(null);
          setUserRole(null);
          setIsLoading(false);
          return;
        }

        setSession(currentSession);

        if (currentSession?.user?.id) {
          const role = await fetchUserRole(currentSession.user.id);
          setUserRole(role);
          
          if (!role) {
            setProfileError('Perfil não encontrado no banco de dados. Entre em contato com o suporte.');
          }
        } else {
          setUserRole(null);
          setProfileError(null);
        }
      } catch (error: any) {
        console.error('Erro ao inicializar autenticação:', error);
        
        // Se for erro de refresh token inválido, limpar tokens
        if (isInvalidRefreshTokenError(error)) {
          console.warn('[AuthContext] Refresh token inválido na inicialização, limpando...');
          await clearInvalidTokens();
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
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

      const authSubscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
        try {
          // Se o evento for relacionado a erro de token, limpar
          if (event === 'TOKEN_REFRESHED' && !newSession) {
            console.warn('[AuthContext] Token refresh falhou, limpando sessão...');
            await clearInvalidTokens();
            setSession(null);
            setUserRole(null);
            setProfileError(null);
            return;
          }

          setSession(newSession);

          if (newSession?.user?.id) {
            const role = await fetchUserRole(newSession.user.id);
            setUserRole(role);
            
            if (!role) {
              setProfileError('Perfil não encontrado no banco de dados. Entre em contato com o suporte.');
            }
          } else {
            setUserRole(null);
            setProfileError(null);
          }
        } catch (error: any) {
          console.error('[AuthContext] Erro no onAuthStateChange:', error);
          
          // Se for erro de refresh token, limpar
          if (isInvalidRefreshTokenError(error)) {
            console.warn('[AuthContext] Refresh token inválido no onAuthStateChange, limpando...');
            await clearInvalidTokens();
            setSession(null);
            setUserRole(null);
            setProfileError(null);
          }
        }
      });

      subscription = authSubscription as unknown as { unsubscribe: () => void };
    } catch (error) {
      console.error('[AuthContext] Erro crítico na inicialização:', error);
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

