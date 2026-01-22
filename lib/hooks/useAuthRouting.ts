import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../supabase';
import { logger } from '../logger';

// Rotas de cadastro e recuperação de senha que devem ser permitidas mesmo com usuário logado
const SIGNUP_ROUTES = [
  'merchant-signup-personal',
  'merchant-signup-address',
  'merchant-signup-business',
  'merchant-signup-services',
  'merchant-signup-loading',
  'client-signup-personal',
  'client-signup-address',
  'client-signup-loading',
  'reset-password', // Permite acesso à tela de reset de senha
] as const;

// Tempo máximo para aguardar o carregamento do perfil antes de deslogar (10 segundos)
const MAX_PROFILE_LOAD_TIME = 10000;

/**
 * Hook para gerenciar roteamento baseado em autenticação
 * Lida com redirecionamentos baseados em sessão, role e estado do cadastro
 */
export function useAuthRouting() {
  const { session, userRole, isLoading, profileError } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileLoadStartRef = useRef<number | null>(null);
  const profileVerifiedViaOAuthRef = useRef(false); // Indica que perfil foi verificado via OAuth

  // Verifica se está em uma rota de cadastro ou recuperação
  const isInSignupFlow = (allSegments: string) => {
    return segments[0] === '(auth)' && SIGNUP_ROUTES.some(route =>
      allSegments.includes(route) || segments.some(seg => seg.includes(route))
    );
  };

  // Função para deslogar e redirecionar para login
  const handleProfileLoadTimeout = async () => {
    if (__DEV__) {
      logger.warn('[useAuthRouting] Timeout de 10s ao carregar perfil - deslogando usuário');
    }

    Alert.alert(
      'Tempo Esgotado',
      'Não foi possível carregar seu perfil. Por favor, faça login novamente.',
      [
        {
          text: 'OK',
          onPress: async () => {
            if (isSupabaseConfigured) {
              try {
                await supabase.auth.signOut();
              } catch (error) {
                if (__DEV__) {
                  logger.error('[useAuthRouting] Erro ao fazer signOut após timeout:', error);
                }
              }
            }
            hasRedirectedRef.current = true;
            router.replace('/(auth)/login');
          },
        },
      ],
      { cancelable: false }
    );
  };

  // Monitora o tempo de carregamento do perfil (10 segundos máximo)
  // IMPORTANTE: Só aplica após login completo, quando usuário está em rota protegida
  useEffect(() => {
    const allSegments = segments.join('/');
    const isInSignup = isInSignupFlow(allSegments);
    const isInResetPassword = segments[0] === '(auth)' && allSegments.includes('reset-password');
    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === '(auth)';
    const inProtectedRoute = currentSegment === '(client)' || currentSegment === '(merchant)';

    // Só aplica timeout se:
    // 1. Há sessão ativa
    // 2. Não está carregando
    // 3. Não tem userRole (perfil não carregado)
    // 4. Não tem erro de perfil
    // 5. Está em rota protegida (client ou merchant) - NÃO em (auth)
    // 6. Não está em fluxo de cadastro
    // 7. Não está em reset de senha
    const shouldApplyTimeout =
      session &&
      !isLoading &&
      !userRole &&
      !profileError &&
      inProtectedRoute && // Só em rotas protegidas, não em (auth)
      !isInSignup &&
      !isInResetPassword &&
      !hasRedirectedRef.current && // Não aplica se já redirecionamos com sucesso via perfil
      !profileVerifiedViaOAuthRef.current; // Não aplica se perfil foi verificado via OAuth

    if (shouldApplyTimeout) {
      // Inicia contador se ainda não foi iniciado
      if (!profileLoadStartRef.current) {
        profileLoadStartRef.current = Date.now();

        if (__DEV__) {
          logger.debug('[useAuthRouting] Iniciando timeout de 10s para carregamento de perfil (após login)');
        }

        // Configura timeout de 10 segundos
        profileLoadTimeoutRef.current = setTimeout(() => {
          const elapsed = Date.now() - (profileLoadStartRef.current || 0);
          if (__DEV__) {
            logger.warn(`[useAuthRouting] Perfil não carregado após ${elapsed}ms - executando logout`);
          }
          handleProfileLoadTimeout();
        }, MAX_PROFILE_LOAD_TIME);
      }
    } else {
      // Limpa o timeout e reseta o contador se:
      // - userRole foi carregado
      // - não há mais sessão
      // - está em fluxo de cadastro/recuperação
      // - está em rota de autenticação (não protegida)
      // - há um erro de perfil
      if (profileLoadTimeoutRef.current) {
        clearTimeout(profileLoadTimeoutRef.current);
        profileLoadTimeoutRef.current = null;
      }
      profileLoadStartRef.current = null;
    }

    // Cleanup ao desmontar
    return () => {
      if (profileLoadTimeoutRef.current) {
        clearTimeout(profileLoadTimeoutRef.current);
        profileLoadTimeoutRef.current = null;
      }
    };
  }, [session, isLoading, userRole, profileError, segments]);

  // Lógica principal de roteamento
  useEffect(() => {
    if (__DEV__) {
      logger.debug('[useAuthRouting] Estado:', {
        isLoading,
        hasSession: !!session,
        userRole,
        profileError,
        segment: segments[0]
      });
    }

    // Retorna early se ainda estiver carregando para evitar redirecionamentos prematuros
    if (isLoading) {
      if (__DEV__) {
        logger.debug('[useAuthRouting] Ainda carregando, aguardando...');
      }
      hasRedirectedRef.current = false;
      return;
    }

    // Limpa timeout anterior se existir
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }

    const allSegments = segments.join('/');
    const isInSignup = isInSignupFlow(allSegments);
    const isInResetPassword = segments[0] === '(auth)' && allSegments.includes('reset-password');

    // Timeout para redirecionar quando há sessão mas não há role
    // Também trata o caso quando segments está vazio (app iniciando)
    const isInAuthOrNoSegment = segments[0] === '(auth)' || !segments[0];

    if (session && !userRole && !profileError && isInAuthOrNoSegment && !isInSignup && !isInResetPassword) {
      // Verifica se é OAuth Google e se já existe perfil completo
      const checkProfileAndRedirect = async () => {
        try {
          // IMPORTANTE: Verificar se já existe um perfil completo para este usuário
          // Isso evita redirecionar para signup quando o usuário já tem conta
          if (isSupabaseConfigured && session.user?.id) {
            const { data: existingProfile, error: profileCheckError } = await supabase
              .from('profiles')
              .select('id, signup_complete, user_type')
              .eq('id', session.user.id)
              .maybeSingle();

            if (__DEV__) {
              logger.debug('[useAuthRouting] Verificação de perfil existente:', {
                userId: session.user.id,
                hasProfile: !!existingProfile,
                signupComplete: existingProfile?.signup_complete,
                userType: existingProfile?.user_type,
                error: profileCheckError?.message,
              });
            }

            // Se o perfil existe e está completo, redirecionar DIRETAMENTE para a home correta
            // Não esperamos o AuthContext buscar o userRole (que pode dar timeout)
            // Usamos o user_type que já temos do perfil
            if (!profileCheckError && existingProfile && existingProfile.signup_complete === true) {
              const targetRoute = existingProfile.user_type === 'merchant'
                ? '/(merchant)/home'
                : '/(client)/home';

              if (__DEV__) {
                logger.debug('[useAuthRouting] ✓ Perfil completo encontrado! Redirecionando diretamente para:', targetRoute);
              }

              // Limpar quaisquer flags OAuth antigas que possam existir
              await AsyncStorage.removeItem('oauth_google_signup');
              await AsyncStorage.removeItem('oauth_google_data');

              // Marcar que perfil foi verificado via OAuth (previne timeout de 10s)
              profileVerifiedViaOAuthRef.current = true;

              // Redirecionar diretamente para a home correta
              if (!hasRedirectedRef.current) {
                hasRedirectedRef.current = true;
                router.replace(targetRoute);
              }

              return; // Não continua o fluxo
            }
          }

          // Se não encontrou perfil completo, verifica a flag OAuth
          const oauthFlag = await AsyncStorage.getItem('oauth_google_signup');

          if (oauthFlag === 'true') {
            // OAuth novo usuário - redireciona imediatamente para signup
            if (__DEV__) {
              logger.debug('[useAuthRouting] OAuth Google novo usuário - redirecionando para user-type-selection');
            }
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              router.replace('/(auth)/user-type-selection');
            }
            return;
          }

          // Não é OAuth OU perfil incompleto - usa o delay padrão de 3s
          if (__DEV__) {
            logger.debug('[useAuthRouting] Sessão existe mas role não encontrado, aguardando 3s antes de redirecionar...');
          }
          redirectTimeoutRef.current = setTimeout(() => {
            if (!hasRedirectedRef.current) {
              if (__DEV__) {
                logger.debug('[useAuthRouting] Timeout: redirecionando para user-type-selection');
              }
              hasRedirectedRef.current = true;
              router.replace('/(auth)/user-type-selection');
            }
            redirectTimeoutRef.current = null;
          }, 3000);
        } catch (error) {
          if (__DEV__) {
            logger.error('[useAuthRouting] Erro ao verificar perfil:', error);
          }
          // Em caso de erro, usa o delay padrão
          redirectTimeoutRef.current = setTimeout(() => {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              router.replace('/(auth)/user-type-selection');
            }
            redirectTimeoutRef.current = null;
          }, 3000);
        }
      };

      checkProfileAndRedirect();
    }

    // Alerta de erro de perfil
    if (profileError && session && !isInResetPassword) {
      if (__DEV__) {
        logger.debug('[useAuthRouting] Erro de perfil detectado');
      }
      Alert.alert(
        'Erro de Perfil',
        `Seu usuário foi autenticado, mas não encontramos seu perfil.\\n\\nUserId: ${session.user?.id}`,
        [
          {
            text: 'Sair',
            onPress: async () => {
              if (isSupabaseConfigured) {
                try {
                  await supabase.auth.signOut();
                } catch (error) {
                  if (__DEV__) {
                    logger.error('[useAuthRouting] Erro ao fazer signOut:', error);
                  }
                }
              }
              router.replace('/');
            },
          },
        ]
      );
      return;
    }

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === '(auth)';
    const inMerchantGroup = currentSegment === '(merchant)';
    const inClientGroup = currentSegment === '(client)';

    // Verifica se está na rota /auth/callback (OAuth callback)
    const inAuthCallback = currentSegment === 'auth' && (segments as string[])[1] === 'callback';

    // Sem sessão: redireciona para login se não estiver em auth ou auth/callback
    if (!session) {
      // Não redireciona se estiver no callback OAuth (aguardando processamento)
      if (inAuthCallback) {
        if (__DEV__) {
          logger.debug('[useAuthRouting] Em /auth/callback, aguardando processamento OAuth');
        }
        return;
      }

      if (!inAuthGroup) {
        if (__DEV__) {
          logger.debug('[useAuthRouting] Sem sessão, redirecionando para login');
        }
        router.replace('/(auth)/login');
      }
      return;
    }

    // Usuário logado: lógica de redirecionamento
    if (__DEV__) {
      logger.debug('[useAuthRouting] Usuário logado, userRole:', userRole, 'segments:', segments);
    }

    if (__DEV__) {
      logger.debug('[useAuthRouting] Verificação de cadastro:', {
        inAuthGroup,
        allSegments,
        isInSignup,
        segments
      });
    }

    // Se está em fluxo de cadastro, permite continuar
    if (isInSignup) {
      if (__DEV__) {
        logger.debug('[useAuthRouting] Usuário em fluxo de cadastro, permitindo continuar');
      }
      hasRedirectedRef.current = false;
      return;
    }

    // Redireciona para home correta baseado no role
    const shouldRedirect = userRole && (
      (inAuthGroup && !isInSignup) ||
      !currentSegment ||
      (userRole === 'merchant' && !inMerchantGroup) ||
      (userRole === 'client' && !inClientGroup)
    );

    if (shouldRedirect && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      const targetRoute = userRole === 'merchant' ? '/(merchant)/home' : '/(client)/home';
      if (__DEV__) {
        logger.debug('[useAuthRouting] Redirecionando', userRole, 'para home:', targetRoute);
      }

      try {
        router.replace(targetRoute);
      } catch (error) {
        if (__DEV__) {
          logger.warn('[useAuthRouting] Erro ao fazer replace, tentando push:', error);
        }
        router.push(targetRoute);
      }
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [session, userRole, isLoading, segments, profileError, router]);

  // Reset do flag quando a sessão muda ou quando navega entre telas de cadastro/recuperação
  useEffect(() => {
    if (!session) {
      hasRedirectedRef.current = false;
      profileVerifiedViaOAuthRef.current = false; // Reset ao deslogar
    } else {
      const allSegments = segments.join('/');
      const isInSignup = isInSignupFlow(allSegments);

      if (isInSignup) {
        hasRedirectedRef.current = false;
      }
    }
  }, [session, segments]);

  // Redirecionamento específico quando temos sessão e role mas segment ainda não definido
  useEffect(() => {
    if (!isLoading && session && userRole && !hasRedirectedRef.current) {
      const currentSegment = segments[0];
      const allSegments = segments.join('/');
      const isInSignup = segments[0] === '(auth)' && isInSignupFlow(allSegments);

      if (__DEV__) {
        logger.debug('[useAuthRouting] useEffect2: Verificação de cadastro:', {
          currentSegment,
          allSegments,
          isInSignup,
          segments
        });
      }

      if (isInSignup) {
        if (__DEV__) {
          logger.debug('[useAuthRouting] useEffect2: Usuário em fluxo de cadastro, permitindo continuar');
        }
        hasRedirectedRef.current = false;
        return;
      }

      if (!isInSignup && userRole && (!currentSegment ||
        (userRole === 'merchant' && currentSegment !== '(merchant)') ||
        (userRole === 'client' && currentSegment !== '(client)'))) {
        const targetRoute = userRole === 'merchant' ? '/(merchant)/home' : '/(client)/home';
        if (__DEV__) {
          logger.debug('[useAuthRouting] useEffect2: Redirecionando', userRole, 'para', targetRoute);
        }
        hasRedirectedRef.current = true;

        requestAnimationFrame(() => {
          router.replace(targetRoute);
        });
      }
    }
  }, [isLoading, session, userRole, segments, router]);
}
