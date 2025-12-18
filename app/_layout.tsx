import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useFonts as useMontserrat, Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useRoboto, Roboto_400Regular, Roboto_500Medium } from '@expo-google-fonts/roboto';
import { useFonts as useMaterialSymbols, MaterialSymbolsOutlined_400Regular } from '@expo-google-fonts/material-symbols-outlined';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ToastProvider } from '../components/ui/ToastProvider';
import { processAuthTokensFromUrl } from '../lib/useDeepLinking';

// Impede o splash screen de sumir automaticamente
SplashScreen.preventAutoHideAsync();

const MainLayout: React.FC = () => {
  const { session, userRole, isLoading, profileError } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const deepLinkProcessedRef = useRef(false);

  useEffect(() => {
    console.log('[MainLayout] Estado:', { isLoading, hasSession: !!session, userRole, profileError, segment: segments[0] });
    
    if (isLoading) {
      console.log('[MainLayout] Ainda carregando, aguardando...');
      hasRedirectedRef.current = false;
      return;
    }

    // Timeout para redirecionar se userRole não for encontrado após login
    let redirectTimeout: NodeJS.Timeout | null = null;
    
    // Verifica se está em uma rota de cadastro ou recuperação de senha antes de ativar o timeout
    const signupRoutes = [
      'merchant-signup-personal',
      'merchant-signup-address',
      'merchant-signup-business',
      'merchant-signup-services',
      'merchant-signup-loading',
      'client-signup-personal',
      'client-signup-address',
      'client-signup-loading',
      'reset-password', // Permite acesso à tela de reset de senha
    ];
    
    const allSegments = segments.join('/');
    const isInSignupFlow = segments[0] === '(auth)' && signupRoutes.some(route => 
      allSegments.includes(route) || segments.some(seg => seg.includes(route))
    );
    
    // Não mostra erro de perfil durante o fluxo de reset de senha
    const isInResetPassword = segments[0] === '(auth)' && allSegments.includes('reset-password');
    
    // Só ativa o timeout se NÃO estiver em fluxo de cadastro E NÃO estiver em reset de senha
    // Durante reset de senha, não devemos redirecionar para user-type-selection
    if (session && !userRole && !profileError && segments[0] === '(auth)' && !isInSignupFlow && !isInResetPassword) {
      console.log('[MainLayout] Sessão existe mas role não encontrado, aguardando 3s antes de redirecionar...');
      redirectTimeout = setTimeout(() => {
        if (!hasRedirectedRef.current) {
          console.log('[MainLayout] Timeout: redirecionando para user-type-selection');
          hasRedirectedRef.current = true;
          router.replace('/(auth)/user-type-selection');
        }
      }, 3000);
    }
    
    if (profileError && session && !isInResetPassword) {
      console.log('[MainLayout] Erro de perfil detectado');
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
                  console.error('[MainLayout] Erro ao fazer signOut:', error);
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

    if (!session) {
      // Se não tem sessão e não está na tela de auth, manda pro login
      if (!inAuthGroup) {
        console.log('[MainLayout] Sem sessão, redirecionando para login');
        router.replace('/(auth)/login');
      }
    } else {
      // Usuário logado
      console.log('[MainLayout] Usuário logado, userRole:', userRole, 'segments:', segments);
      
      // Rotas de cadastro e recuperação de senha que devem ser permitidas mesmo com usuário logado
      const signupRoutes = [
        'merchant-signup-personal',
        'merchant-signup-address',
        'merchant-signup-business',
        'merchant-signup-services',
        'merchant-signup-loading',
        'client-signup-personal',
        'client-signup-address',
        'client-signup-loading',
        'reset-password', // Permite acesso à tela de reset de senha
      ];
      
      // Verifica se está em uma rota de cadastro ou recuperação
      // Verifica todos os segments para encontrar rotas permitidas
      const allSegments = segments.join('/');
      const isInSignupFlow = inAuthGroup && signupRoutes.some(route => 
        allSegments.includes(route) || segments.some(seg => seg.includes(route))
      );
      
      console.log('[MainLayout] Verificação de cadastro:', { 
        inAuthGroup, 
        allSegments, 
        isInSignupFlow,
        segments 
      });
      
      // Se está em fluxo de cadastro, permite continuar
      if (isInSignupFlow) {
        console.log('[MainLayout] Usuário em fluxo de cadastro, permitindo continuar');
        hasRedirectedRef.current = false; // Reset flag para permitir navegação
        return;
      }
      
      // Se está em telas de auth (mas não em cadastro), segment ainda não definido, ou não está na home correta, redireciona
      // IMPORTANTE: Só redireciona se NÃO estiver em fluxo de cadastro
      // E só redireciona se tiver userRole definido (para evitar redirecionamentos durante o cadastro)
      const shouldRedirect = !isInSignupFlow && userRole && (
        (inAuthGroup && !isInSignupFlow) || !currentSegment || 
        (userRole === 'merchant' && !inMerchantGroup) ||
        (userRole === 'client' && !inClientGroup)
      );
      
      if (shouldRedirect && !hasRedirectedRef.current) {
        // Redireciona para a home correta baseado no role
        hasRedirectedRef.current = true;
        const targetRoute = userRole === 'merchant' ? '/(merchant)/home' : '/(client)/home';
        console.log('[MainLayout] Redirecionando', userRole, 'para home:', targetRoute);
        
        // Tenta replace primeiro, se falhar tenta push
        try {
          router.replace(targetRoute);
        } catch (error) {
          console.warn('[MainLayout] Erro ao fazer replace, tentando push:', error);
          router.push(targetRoute);
        }
      }
    }

    return () => {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [session, userRole, isLoading, segments, profileError, router]);

  // Reset do flag quando a sessão muda ou quando navega entre telas de cadastro/recuperação
  useEffect(() => {
    if (!session) {
      hasRedirectedRef.current = false;
    } else {
      // Verifica se está em uma rota de cadastro ou recuperação e reseta o flag
      const signupRoutes = [
        'merchant-signup-personal',
        'merchant-signup-address',
        'merchant-signup-business',
        'merchant-signup-services',
        'merchant-signup-loading',
        'client-signup-personal',
        'client-signup-address',
        'client-signup-loading',
        'reset-password', // Permite acesso à tela de reset de senha
      ];
      
      const allSegments = segments.join('/');
      const isInSignupFlow = segments[0] === '(auth)' && signupRoutes.some(route => 
        allSegments.includes(route) || segments.some(seg => seg.includes(route))
      );
      
      if (isInSignupFlow) {
        hasRedirectedRef.current = false; // Permite navegação entre telas de cadastro/recuperação
      }
    }
  }, [session, segments]);

  // Redirecionamento específico quando temos sessão e role mas segment ainda não definido
  useEffect(() => {
    if (!isLoading && session && userRole && !hasRedirectedRef.current) {
      const currentSegment = segments[0];
      const inAuthGroup = currentSegment === '(auth)';
      
      // Rotas de cadastro e recuperação de senha que devem ser permitidas mesmo com usuário logado
      const signupRoutes = [
        'merchant-signup-personal',
        'merchant-signup-address',
        'merchant-signup-business',
        'merchant-signup-services',
        'merchant-signup-loading',
        'client-signup-personal',
        'client-signup-address',
        'client-signup-loading',
        'reset-password', // Permite acesso à tela de reset de senha
      ];
      
      // Verifica se está em uma rota de cadastro ou recuperação
      // Verifica todos os segments para encontrar rotas permitidas
      const allSegments = segments.join('/');
      const isInSignupFlow = inAuthGroup && signupRoutes.some(route => 
        allSegments.includes(route) || segments.some(seg => seg.includes(route))
      );
      
      console.log('[MainLayout] useEffect2: Verificação de cadastro:', { 
        inAuthGroup, 
        allSegments, 
        isInSignupFlow,
        segments 
      });
      
      // Se está em fluxo de cadastro, permite continuar
      if (isInSignupFlow) {
        console.log('[MainLayout] useEffect2: Usuário em fluxo de cadastro, permitindo continuar');
        hasRedirectedRef.current = false; // Reset flag para permitir navegação
        return;
      }
      
      // Se o segment ainda não está definido ou está na tela errada, redireciona
      // IMPORTANTE: Só redireciona se NÃO estiver em fluxo de cadastro
      // E só redireciona se tiver userRole definido (para evitar redirecionamentos durante o cadastro)
      if (!isInSignupFlow && userRole && (!currentSegment || 
          (userRole === 'merchant' && currentSegment !== '(merchant)') ||
          (userRole === 'client' && currentSegment !== '(client)'))) {
        const targetRoute = userRole === 'merchant' ? '/(merchant)/home' : '/(client)/home';
        console.log('[MainLayout] useEffect2: Redirecionando', userRole, 'para', targetRoute);
        hasRedirectedRef.current = true;
        
        // Usa requestAnimationFrame para garantir que o router está pronto
        requestAnimationFrame(() => {
          router.replace(targetRoute);
        });
      }
    }
  }, [isLoading, session, userRole, segments, router]);

  // Intercepta deep links de reset-password ANTES do Expo Router processá-los
  // Isso garante que possamos processar os tokens mesmo quando a Activity é reiniciada
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      // Ignora URLs do Expo dev server
      if (event.url && event.url.includes('expo-development-client')) {
        console.log('[MainLayout] URL do Expo dev server ignorada no listener global:', event.url);
        // Tenta obter a URL real do getInitialURL
        try {
          const realUrl = await Linking.getInitialURL();
          
          if (realUrl && realUrl.includes('reset-password') && !realUrl.includes('expo-development-client')) {
            console.log('[MainLayout] URL real encontrada via getInitialURL no _layout:', realUrl);
            // Processa os tokens e navega para reset-password
            try {
              const success = await processAuthTokensFromUrl(realUrl);
              if (success) {
                console.log('[MainLayout] Tokens processados com sucesso no _layout, navegando para reset-password');
                router.replace('/(auth)/reset-password');
                deepLinkProcessedRef.current = true;
              }
            } catch (error: any) {
              console.error('[MainLayout] Erro ao processar tokens no _layout:', error);
              // Se for erro do Supabase, navega para reset-password mesmo assim
              // O componente reset-password.tsx vai tratar o erro
              if (error?.message?.startsWith('SUPABASE_ERROR:')) {
                router.replace('/(auth)/reset-password');
                deepLinkProcessedRef.current = true;
              }
            }
          }
        } catch (error) {
          console.warn('[MainLayout] Erro ao obter URL real no _layout:', error);
        }
        return;
      }
      
      // Se for um deep link de reset-password, processa os tokens e navega
      if (event.url && event.url.includes('reset-password') && !deepLinkProcessedRef.current) {
        console.log('[MainLayout] Deep link de reset-password detectado no _layout, processando...');
        deepLinkProcessedRef.current = true;
        
        try {
          const success = await processAuthTokensFromUrl(event.url);
          
          if (success) {
            console.log('[MainLayout] Tokens processados com sucesso no _layout, navegando para reset-password');
            router.replace('/(auth)/reset-password');
          } else {
            // Mesmo se falhar, navega para reset-password para mostrar o erro
            console.log('[MainLayout] Falha ao processar tokens, navegando para reset-password mesmo assim');
            router.replace('/(auth)/reset-password');
          }
        } catch (error: any) {
          console.error('[MainLayout] Erro ao processar tokens no _layout:', error);
          // Se for erro do Supabase, navega para reset-password mesmo assim
          if (error?.message?.startsWith('SUPABASE_ERROR:')) {
            router.replace('/(auth)/reset-password');
          }
        }
      }
    };
    
    // Registra o listener global
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Também verifica getInitialURL() periodicamente para warm start
    let checkInterval: NodeJS.Timeout | null = null;
    let checkCount = 0;
    const maxChecks = 20; // 6 segundos (20 * 300ms)
    
    const startPeriodicCheck = () => {
      checkInterval = setInterval(async () => {
        checkCount++;
        
        // Para se já processou ou excedeu o limite
        if (deepLinkProcessedRef.current || checkCount >= maxChecks) {
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
          }
          return;
        }
        
        try {
          const checkUrl = await Linking.getInitialURL();
          
          if (checkUrl && checkUrl.includes('reset-password') && !checkUrl.includes('expo-development-client') && !deepLinkProcessedRef.current) {
            console.log('[MainLayout] URL encontrada na verificação periódica do _layout, processando...');
            deepLinkProcessedRef.current = true;
            
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }
            
            try {
              const success = await processAuthTokensFromUrl(checkUrl);
              if (success) {
                console.log('[MainLayout] Tokens processados com sucesso na verificação periódica, navegando para reset-password');
                router.replace('/(auth)/reset-password');
              } else {
                router.replace('/(auth)/reset-password');
              }
            } catch (error: any) {
              console.error('[MainLayout] Erro ao processar tokens na verificação periódica:', error);
              if (error?.message?.startsWith('SUPABASE_ERROR:')) {
                router.replace('/(auth)/reset-password');
              }
            }
          }
        } catch (error) {
          console.warn('[MainLayout] Erro na verificação periódica:', error);
        }
      }, 300);
    };
    
    // Inicia a verificação periódica após 500ms
    setTimeout(() => {
      if (!deepLinkProcessedRef.current) {
        startPeriodicCheck();
      }
    }, 500);
    
    return () => {
      subscription.remove();
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      deepLinkProcessedRef.current = false;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F6F9' }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F4F6F9' }, // Garante fundo consistente
          animation: 'default',
        }}
      />
    </View>
  );
};

const RootLayout: React.FC = () => {
  const [montserratLoaded] = useMontserrat({
    Montserrat_400Regular,
    Montserrat_700Bold,
  });

  const [robotoLoaded] = useRoboto({
    Roboto_400Regular,
    Roboto_500Medium,
  });

  const [materialSymbolsLoaded] = useMaterialSymbols({
    MaterialSymbolsOutlined_400Regular,
  });

  const fontsLoaded = montserratLoaded && robotoLoaded && materialSymbolsLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Retorna uma View vazia em vez de null para evitar problemas de renderização
    return <View style={{ flex: 1, backgroundColor: '#F4F6F9' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* StatusBar configurada globalmente */}
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        
        <ToastProvider>
          <AuthProvider>
            <MainLayout />
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
