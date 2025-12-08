import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useMontserrat, Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useRoboto, Roboto_400Regular, Roboto_500Medium } from '@expo-google-fonts/roboto';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

// Componente interno que consome o AuthContext e implementa proteção de rotas
const MainLayout: React.FC = () => {
  const { session, userRole, isLoading, profileError } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // ✅ Mostrar alerta se houver erro de perfil
  useEffect(() => {
    if (profileError && session) {
      Alert.alert(
        '⚠️ Erro de Perfil',
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
    // Aguarda o carregamento completo (auth + fonts)
    if (isLoading) {
      return;
    }

    // Pega o primeiro segmento da rota (ex: '(auth)', '(client)', '(merchant)')
    const inAuthGroup = segments[0] === '(auth)';
    const inClientGroup = segments[0] === '(client)';
    const inMerchantGroup = segments[0] === '(merchant)';

    // Se NÃO tem sessão e está tentando acessar rotas protegidas
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    // Se TEM sessão
    if (session) {
      // Rotas de signup que devem ser permitidas mesmo com sessão ativa
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
      
      // Converte segments para string e verifica se está no fluxo de signup
      const segmentsString = segments.join('/');
      const isInSignupFlow = signupRoutes.some(route => segmentsString.includes(route));
      
      // Se está na tela de auth e tem userRole, redireciona (exceto se estiver em signup)
      if (inAuthGroup && userRole && !isInSignupFlow) {
        if (userRole === 'merchant') {
          router.replace('/(merchant)/dashboard');
        } else if (userRole === 'client') {
          router.replace('/(client)/home');
        }
        return;
      }

      // Cliente logado tentando acessar rotas de merchant ou auth (exceto signup)
      if (userRole === 'client' && (inMerchantGroup || (inAuthGroup && !isInSignupFlow))) {
        router.replace('/(client)/home');
        return;
      }

      // Merchant logado tentando acessar rotas de client ou auth (exceto signup)
      if (userRole === 'merchant' && (inClientGroup || (inAuthGroup && !isInSignupFlow))) {
        router.replace('/(merchant)/dashboard');
        return;
      }

      // Se está na tela de auth mas userRole ainda é null, aguardar um pouco mais
      if (inAuthGroup && !userRole) {
        // Não fazer nada, aguardar o userRole ser carregado
        return;
      }
    }
  }, [session, userRole, isLoading, segments, router]);

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
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Aguarda fontes carregarem antes de renderizar
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default RootLayout;