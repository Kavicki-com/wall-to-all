import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useMontserrat, Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useRoboto, Roboto_400Regular, Roboto_500Medium } from '@expo-google-fonts/roboto';
import { useFonts as useMaterialSymbols, MaterialSymbolsOutlined_400Regular } from '@expo-google-fonts/material-symbols-outlined';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ToastProvider } from '../components/ui/ToastProvider';

// Impede o splash screen de sumir automaticamente
SplashScreen.preventAutoHideAsync();

const MainLayout: React.FC = () => {
  const { session, userRole, isLoading, profileError } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    console.log('[MainLayout] Estado:', { isLoading, hasSession: !!session, userRole, profileError, segment: segments[0] });
    
    if (isLoading) {
      console.log('[MainLayout] Ainda carregando, aguardando...');
      hasRedirectedRef.current = false;
      return;
    }

    // Timeout para redirecionar se userRole não for encontrado após login
    let redirectTimeout: NodeJS.Timeout | null = null;
    
    // Verifica se está em uma rota de cadastro antes de ativar o timeout
    const signupRoutes = [
      'merchant-signup-personal',
      'merchant-signup-address',
      'merchant-signup-business',
      'merchant-signup-services',
      'merchant-signup-loading',
      'client-signup-personal',
      'client-signup-address',
      'client-signup-loading',
    ];
    
    const allSegments = segments.join('/');
    const isInSignupFlow = segments[0] === '(auth)' && signupRoutes.some(route => 
      allSegments.includes(route) || segments.some(seg => seg.includes(route))
    );
    
    // Só ativa o timeout se NÃO estiver em fluxo de cadastro
    if (session && !userRole && !profileError && segments[0] === '(auth)' && !isInSignupFlow) {
      console.log('[MainLayout] Sessão existe mas role não encontrado, aguardando 3s antes de redirecionar...');
      redirectTimeout = setTimeout(() => {
        if (!hasRedirectedRef.current) {
          console.log('[MainLayout] Timeout: redirecionando para user-type-selection');
          hasRedirectedRef.current = true;
          router.replace('/(auth)/user-type-selection');
        }
      }, 3000);
    }

    if (profileError && session) {
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
      
      // Rotas de cadastro que devem ser permitidas mesmo com usuário logado
      const signupRoutes = [
        'merchant-signup-personal',
        'merchant-signup-address',
        'merchant-signup-business',
        'merchant-signup-services',
        'merchant-signup-loading',
        'client-signup-personal',
        'client-signup-address',
        'client-signup-loading',
      ];
      
      // Verifica se está em uma rota de cadastro
      // Verifica todos os segments para encontrar rotas de cadastro
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

  // Reset do flag quando a sessão muda ou quando navega entre telas de cadastro
  useEffect(() => {
    if (!session) {
      hasRedirectedRef.current = false;
    } else {
      // Verifica se está em uma rota de cadastro e reseta o flag
      const signupRoutes = [
        'merchant-signup-personal',
        'merchant-signup-address',
        'merchant-signup-business',
        'merchant-signup-services',
        'merchant-signup-loading',
        'client-signup-personal',
        'client-signup-address',
        'client-signup-loading',
      ];
      
      const allSegments = segments.join('/');
      const isInSignupFlow = segments[0] === '(auth)' && signupRoutes.some(route => 
        allSegments.includes(route) || segments.some(seg => seg.includes(route))
      );
      
      if (isInSignupFlow) {
        hasRedirectedRef.current = false; // Permite navegação entre telas de cadastro
      }
    }
  }, [session, segments]);

  // Redirecionamento específico quando temos sessão e role mas segment ainda não definido
  useEffect(() => {
    if (!isLoading && session && userRole && !hasRedirectedRef.current) {
      const currentSegment = segments[0];
      const inAuthGroup = currentSegment === '(auth)';
      
      // Rotas de cadastro que devem ser permitidas mesmo com usuário logado
      const signupRoutes = [
        'merchant-signup-personal',
        'merchant-signup-address',
        'merchant-signup-business',
        'merchant-signup-services',
        'merchant-signup-loading',
        'client-signup-personal',
        'client-signup-address',
        'client-signup-loading',
      ];
      
      // Verifica se está em uma rota de cadastro
      // Verifica todos os segments para encontrar rotas de cadastro
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
