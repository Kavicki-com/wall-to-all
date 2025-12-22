import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../supabase';
import { logger } from '../logger';

// Rotas de cadastro que devem ser permitidas mesmo com usuário logado
const SIGNUP_ROUTES = [
  'merchant-signup-personal',
  'merchant-signup-address',
  'merchant-signup-business',
  'merchant-signup-services',
  'merchant-signup-loading',
  'client-signup-personal',
  'client-signup-address',
  'client-signup-loading',
  'reset-password',
] as const;

/**
 * Hook para verificar se o cadastro está completo
 * Faz logout e redireciona para login se o cadastro estiver incompleto
 */
export function useSignupCheck() {
  const { session, userRole } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const signupCheckRef = useRef(false);

  useEffect(() => {
    // Verifica se está em uma rota de cadastro
    const allSegments = segments.join('/');
    const isInSignupFlow = segments[0] === '(auth)' && SIGNUP_ROUTES.some(route => 
      allSegments.includes(route) || segments.some(seg => seg.includes(route))
    );

    // Só verifica se o usuário está logado, tem role de client ou merchant,
    // não está em fluxo de cadastro e ainda não foi verificado
    if ((userRole === 'client' || userRole === 'merchant') && 
        !isInSignupFlow && 
        !signupCheckRef.current &&
        session) {
      signupCheckRef.current = true;
      
      const checkSignupComplete = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            signupCheckRef.current = false;
            return;
          }

          // Verificar signup_complete em profiles (fonte única de verdade)
          const { data: profile } = await supabase
            .from('profiles')
            .select('signup_complete, last_signup_step, user_type')
            .eq('id', user.id)
            .maybeSingle();

          // Cadastro está incompleto se:
          // 1. Não existe perfil em profiles, OU
          // 2. signup_complete é false/null
          // Fallback: verificar perfil específico se signup_complete não existir ainda
          let isSignupComplete = profile && profile.signup_complete === true;

          // Fallback para compatibilidade durante migração
          if (!isSignupComplete && profile) {
            if (profile.user_type === 'client') {
              const { data: clientProfile } = await supabase
                .from('client_profiles')
                .select('signup_complete, address')
                .eq('owner_id', user.id)
                .maybeSingle();
              
              isSignupComplete = clientProfile && (
                clientProfile.signup_complete === true ||
                (clientProfile.signup_complete === undefined && clientProfile?.address && clientProfile.address.trim() !== '')
              );
            } else if (profile.user_type === 'merchant') {
              const { data: businessProfile } = await supabase
                .from('business_profiles')
                .select('signup_complete, address')
                .eq('owner_id', user.id)
                .maybeSingle();
              
              const hasAddress = businessProfile?.address && businessProfile.address.trim() !== '';

              isSignupComplete = businessProfile && (
                businessProfile.signup_complete === true ||
                (businessProfile.signup_complete === undefined && hasAddress)
              );
            }
          }

          if (!isSignupComplete) {
            if (__DEV__) { 
              logger.debug('[useSignupCheck] Cadastro incompleto, fazendo logout e redirecionando para login');
            }
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
            signupCheckRef.current = false;
            return;
          }
          signupCheckRef.current = false;
        } catch (error) {
          if (__DEV__) {
            logger.error('[useSignupCheck] Erro ao verificar cadastro completo:', error);
          }
          // Em caso de erro, fazer logout por segurança
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            if (__DEV__) {
              logger.error('[useSignupCheck] Erro ao fazer logout:', signOutError);
            }
          }
          router.replace('/(auth)/login');
          signupCheckRef.current = false;
        }
      };

      checkSignupComplete();
    }

    // Reset do flag quando a sessão muda
    if (!session) {
      signupCheckRef.current = false;
    }
  }, [session, userRole, segments, router]);
}

