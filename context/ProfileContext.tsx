import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';

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
  refreshProfile: async () => {},
});

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!session?.user?.id) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        logger.error('[ProfileContext] Erro ao buscar perfil:', profileError);
        setError(profileError.message);
        setProfile(null);
      } else if (profileData) {
        setProfile(profileData as Profile);
        setError(null);
      } else {
        setProfile(null);
        setError('Perfil não encontrado');
      }
    } catch (err: unknown) {
      logger.error('[ProfileContext] Erro ao carregar perfil:', err);
      const error = err as { message?: string };
      setError(error.message || 'Erro ao carregar perfil');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

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
