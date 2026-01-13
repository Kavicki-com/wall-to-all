import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, safeSupabaseCall } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';
import { handleError } from '../lib/errorHandler';
import { useToast } from '../components/ui/ToastProvider';

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string;
  created_at?: string;
  [key: string]: unknown; // Para permitir outros campos do perfil
};

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  error: null,
  refreshProfile: async () => { },
});

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const { session, validateSession } = useAuth();
  const { showError } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Verifica se há sessão válida antes de fazer chamada de API
      if (!session?.user?.id) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Valida sessão antes de fazer a chamada
      if (validateSession) {
        try {
          const isValid = await validateSession();
          if (!isValid) {
            setProfile(null);
            const msg = 'Sessão expirada. Por favor, faça login novamente.';
            setError(msg);
            showError(msg);
            setLoading(false);
            return;
          }
        } catch (validationError) {
          if (__DEV__) {
            logger.warn('[ProfileContext] Erro ao validar sessão:', validationError);
          }
          // Continua mesmo se validação falhar - safeSupabaseCall vai tratar
        }
      }

      // Usa safeSupabaseCall para interceptar erros de autenticação
      const result = await safeSupabaseCall(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
      });

      if (result.error) {
        const processedError = handleError(result.error, 'profile');
        logger.error('[ProfileContext] Erro ao buscar perfil:', result.error);
        setError(processedError.userMessage);
        showError(processedError.userMessage);
        setProfile(null);
      } else if (result.data) {
        setProfile(result.data as Profile);
        setError(null);
      } else {
        setProfile(null);
        setError('Perfil não encontrado');
      }
    } catch (err: unknown) {
      logger.error('[ProfileContext] Erro ao carregar perfil:', err);
      const processedError = handleError(err, 'profile');
      setError(processedError.userMessage);
      showError(processedError.userMessage);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, validateSession]);

  // Recarregar perfil quando a sessão mudar
  useEffect(() => {
    if (session?.user?.id) {
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
      setError(null);
    }
  }, [session?.user?.id, loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const value: ProfileContextType = {
    profile,
    loading,
    error,
    refreshProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile deve ser usado dentro de um ProfileProvider');
  }
  return context;
};
