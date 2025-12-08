import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'client' | 'merchant' | null;

interface AuthContextType {
  session: Session | null;
  userRole: UserRole;
  isLoading: boolean;
  profileError: string | null; // ✅ Novo: erro quando perfil não existe
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
        // Se o erro é PGRST116 (perfil não encontrado), é esperado durante cadastro
        if (error.code !== 'PGRST116') {
          console.error('[AuthContext] Erro ao buscar user_type:', error);
        }
        return null;
      }

      if (!data) {
        console.warn('⚠️ [AuthContext] PERFIL NÃO ENCONTRADO na tabela profiles!');
        console.warn('⚠️ UserId:', userId);
        return null;
      }

      const userType = data?.user_type as UserRole;
      
      // ✅ Limpar erro de perfil se encontrado com sucesso
      setProfileError(null);
      
      return userType || null;
    } catch (error) {
      console.error('[AuthContext] Erro ao buscar role do usuário:', error);
      return null;
    }
  };

  useEffect(() => {
    // Função para inicializar sessão e role
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Verifica sessão atual
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Erro ao buscar sessão:', sessionError);
          setSession(null);
          setUserRole(null);
          setIsLoading(false);
          return;
        }

        setSession(currentSession);

        // Se há sessão, busca o role do usuário
        if (currentSession?.user?.id) {
          const role = await fetchUserRole(currentSession.user.id);
          setUserRole(role);
          
          // ✅ Se login bem-sucedido mas sem perfil, definir erro
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

    // Inicializa na montagem
    initializeAuth();

    // Escuta mudanças de autenticação em tempo real
    const {
      data: { subscription },
    } =     supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);

      // Se há nova sessão, busca o role
      if (newSession?.user?.id) {
        const role = await fetchUserRole(newSession.user.id);
        setUserRole(role);
        
        // ✅ Se login bem-sucedido mas sem perfil, definir erro
        if (!role) {
          setProfileError('Perfil não encontrado no banco de dados. Entre em contato com o suporte.');
        }
      } else {
        setUserRole(null);
        setProfileError(null);
      }
    });

    // Cleanup subscription
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

