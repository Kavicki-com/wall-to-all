import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, safeSupabaseCall } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';
import { handleError } from '../lib/errorHandler';
import { useToast } from '../components/ui/ToastProvider';

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
  refreshBusinessProfile: async () => { },
});

interface BusinessProfileProviderProps {
  children: ReactNode;
}

export const BusinessProfileProvider: React.FC<BusinessProfileProviderProps> = ({ children }) => {
  const { session, validateSession } = useAuth();
  const { showError } = useToast();
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadBusinessProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Verifica se há sessão válida antes de fazer chamada de API
      if (!session?.user?.id) {
        setBusinessProfile(null);
        setLoading(false);
        return;
      }

      // Valida sessão antes de fazer a chamada
      if (validateSession) {
        try {
          const isValid = await validateSession();
          if (!isValid) {
            setBusinessProfile(null);
            const msg = 'Sessão expirada. Por favor, faça login novamente.';
            setError(msg);
            showError(msg);
            setLoading(false);
            return;
          }
        } catch (validationError) {
          if (__DEV__) {
            logger.warn('[BusinessProfileContext] Erro ao validar sessão:', validationError);
          }
          // Continua mesmo se validação falhar - safeSupabaseCall vai tratar
        }
      }

      // Usa safeSupabaseCall para interceptar erros de autenticação
      const result = await safeSupabaseCall(async () => {
        return await supabase
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
      });

      if (result.error) {
        // PGRST116 significa que não há perfil (0 linhas) - isso é esperado em alguns casos
        if (result.error && typeof result.error === 'object' && 'code' in result.error && result.error.code !== 'PGRST116') {
          const processedError = handleError(result.error, 'businessProfile');
          logger.error('[BusinessProfileContext] Erro ao buscar perfil do negócio:', result.error);
          setError(processedError.userMessage);
          showError(processedError.userMessage);
        }
        setBusinessProfile(null);
      } else if (result.data) {
        // Processar categoria para garantir formato consistente
        const data = result.data as any;
        const profile = {
          ...data,
          categories: Array.isArray(data.categories)
            ? data.categories[0] || null
            : data.categories || null,
        } as BusinessProfile;
        setBusinessProfile(profile);
        setError(null);
      } else {
        setBusinessProfile(null);
        setError('Perfil do negócio não encontrado');
      }
    } catch (err: unknown) {
      logger.error('[BusinessProfileContext] Erro ao carregar perfil do negócio:', err);
      const processedError = handleError(err, 'businessProfile');
      setError(processedError.userMessage);
      showError(processedError.userMessage);
      setBusinessProfile(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, validateSession]);

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

