import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';

export type BusinessProfile = {
  id: number;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  category_id?: number | null;
  owner_id: string;
  work_days?: Record<string, { start: string; end: string }> | null;
  accepted_payment_methods?: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
  categories?: {
    id: number;
    name: string;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Para permitir outros campos do perfil que podem não estar tipados
};

interface BusinessProfileContextType {
  businessProfile: BusinessProfile | null;
  loading: boolean;
  error: string | null;
  refreshBusinessProfile: () => Promise<void>;
}

const BusinessProfileContext = createContext<BusinessProfileContextType>({
  businessProfile: null,
  loading: true,
  error: null,
  refreshBusinessProfile: async () => {},
});

interface BusinessProfileProviderProps {
  children: ReactNode;
}

export const BusinessProfileProvider: React.FC<BusinessProfileProviderProps> = ({ children }) => {
  const { session } = useAuth();
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadBusinessProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!session?.user?.id) {
        setBusinessProfile(null);
        setLoading(false);
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select(`
          *,
          banner_url,
          categories:category_id (
            id,
            name
          )
        `)
        .eq('owner_id', session.user.id)
        .single();

      if (businessError) {
        // PGRST116 significa que não há perfil (0 linhas) - isso é esperado em alguns casos
        if (businessError.code !== 'PGRST116') {
          logger.error('[BusinessProfileContext] Erro ao buscar perfil do negócio:', businessError);
          setError(businessError.message);
        }
        setBusinessProfile(null);
      } else if (businessData) {
        // Processar categoria para garantir formato consistente
        const profile = {
          ...businessData,
          categories: Array.isArray(businessData.categories) 
            ? businessData.categories[0] || null
            : businessData.categories || null,
        } as BusinessProfile;
        setBusinessProfile(profile);
        setError(null);
      } else {
        setBusinessProfile(null);
        setError('Perfil do negócio não encontrado');
      }
    } catch (err: unknown) {
      logger.error('[BusinessProfileContext] Erro ao carregar perfil do negócio:', err);
      const error = err as { message?: string };
      setError(error.message || 'Erro ao carregar perfil do negócio');
      setBusinessProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Recarregar perfil quando a sessão mudar
  useEffect(() => {
    if (session?.user?.id) {
      loadBusinessProfile();
    } else {
      setBusinessProfile(null);
      setLoading(false);
      setError(null);
    }
  }, [session?.user?.id, loadBusinessProfile]);

  const refreshBusinessProfile = useCallback(async () => {
    await loadBusinessProfile();
  }, [loadBusinessProfile]);

  const value: BusinessProfileContextType = {
    businessProfile,
    loading,
    error,
    refreshBusinessProfile,
  };

  return <BusinessProfileContext.Provider value={value}>{children}</BusinessProfileContext.Provider>;
};

export const useBusinessProfile = (): BusinessProfileContextType => {
  const context = useContext(BusinessProfileContext);
  if (!context) {
    throw new Error('useBusinessProfile deve ser usado dentro de um BusinessProfileProvider');
  }
  return context;
};

