import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useMontserrat, Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useRoboto, Roboto_400Regular, Roboto_500Medium } from '@expo-google-fonts/roboto';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

const MainLayout: React.FC = () => {
  const { session, userRole, isLoading, profileError } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    if (profileError && session) {
      Alert.alert(
        'Erro de Perfil',
        `Seu usuário foi autenticado, mas não encontramos seu perfil no banco de dados.\n\nUserId: ${session.user?.id}\n\nPor favor, entre em contato com o suporte ou crie o perfil manualmente no Supabase.`,
        [
          {
            text: 'Fazer Logout',
            onPress: async () => {
              await supabase.auth.signOut();
            },
            style: 'destructive',
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    }
  }, [profileError, session]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    // Aguardar um pouco para garantir que o router está pronto
    const timeoutId = setTimeout(() => {
      try {
        const currentSegment = segments[0] || '';
        const inAuthGroup = currentSegment === '(auth)';
        const inClientGroup = currentSegment === '(client)';
        const inMerchantGroup = currentSegment === '(merchant)';

        // Se não há segmentos ou está na rota raiz, redirecionar
        if (!currentSegment || currentSegment === 'index') {
          if (!session) {
            router.replace('/(auth)/login');
            setNavigationReady(true);
            return;
          } else if (userRole) {
            if (userRole === 'merchant') {
              router.replace('/(merchant)/dashboard');
            } else if (userRole === 'client') {
              router.replace('/(client)/home');
            }
            setNavigationReady(true);
            return;
          } else {
            // Tem sessão mas não tem role - redirecionar para login
            router.replace('/(auth)/login');
            setNavigationReady(true);
            return;
          }
        }

        if (!session && !inAuthGroup) {
          router.replace('/(auth)/login');
          setNavigationReady(true);
          return;
        }

        if (session) {
          const signupRoutes = [
            'client-signup-personal',
            'client-signup-address',
            'client-signup-loading',
            'merchant-signup-personal',
            'merchant-signup-address',
            'merchant-signup-business',
            'merchant-signup-services',
            'merchant-signup-loading',
          ];
          
          const segmentsString = segments.join('/');
          const isInSignupFlow = signupRoutes.some(route => segmentsString.includes(route));
          
          if (inAuthGroup && userRole && !isInSignupFlow) {
            if (userRole === 'merchant') {
              router.replace('/(merchant)/dashboard');
            } else if (userRole === 'client') {
              router.replace('/(client)/home');
            }
            setNavigationReady(true);
            return;
          }

          if (userRole === 'client' && (inMerchantGroup || (inAuthGroup && !isInSignupFlow))) {
            router.replace('/(client)/home');
            setNavigationReady(true);
            return;
          }

          if (userRole === 'merchant' && (inClientGroup || (inAuthGroup && !isInSignupFlow))) {
            router.replace('/(merchant)/dashboard');
            setNavigationReady(true);
            return;
          }

          if (inAuthGroup && !userRole) {
            setNavigationReady(true);
            return;
          }
        }

        setNavigationReady(true);
      } catch (error) {
        console.error('Erro na navegação:', error);
        // Em caso de erro, redirecionar para login
        if (!session) {
          router.replace('/(auth)/login');
        }
        setNavigationReady(true);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [session, userRole, isLoading, segments, router]);

  // Timeout de segurança: se isLoading ficar travado, força a renderização após 5 segundos
  useEffect(() => {
    if (isLoading) {
      const timeoutId = setTimeout(() => {
        console.warn('[MainLayout] Timeout no loading - forçando navegação');
        setNavigationReady(true);
        // Se ainda não há sessão após timeout, redirecionar para login
        if (!session) {
          try {
            router.replace('/(auth)/login');
          } catch (err) {
            console.error('[MainLayout] Erro ao redirecionar após timeout', err);
          }
        }
      }, 5000);

      return () => clearTimeout(timeoutId);
    } else {
      // Se não está mais carregando, garantir que navigationReady seja true após um pequeno delay
      const timeoutId = setTimeout(() => {
        if (!navigationReady) {
          console.warn('[MainLayout] Forçando navigationReady após delay');
          setNavigationReady(true);
          // Garantir redirecionamento se necessário
          if (!segments[0] && !session) {
            try {
              router.replace('/(auth)/login');
            } catch (err) {
              console.error('[MainLayout] Erro ao redirecionar', err);
            }
          }
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, navigationReady, session, segments, router]);

  // Sempre renderizar o Stack, mesmo durante o loading
  // O Stack do expo-router gerencia a renderização das telas internamente
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
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

  const fontsLoaded = montserratLoaded && robotoLoaded;

  useEffect(() => {
    // Timeout de segurança: esconde o splash screen após 3 segundos mesmo se as fontes não carregarem
    const timeoutId = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {
        // Ignora erros ao esconder o splash screen
      });
    }, 3000);

    if (fontsLoaded) {
      clearTimeout(timeoutId);
      SplashScreen.hideAsync().catch(() => {
        // Ignora erros ao esconder o splash screen
      });
    }

    return () => clearTimeout(timeoutId);
  }, [fontsLoaded]);

  // Não retorna null - sempre renderiza algo, mesmo que as fontes não tenham carregado
  // As fontes serão aplicadas quando carregarem, mas o app não ficará em branco
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default RootLayout;