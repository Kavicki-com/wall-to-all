import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
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
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error);
        setSession(null);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
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
    });

    return () => {
      subscription.unsubscribe();
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

