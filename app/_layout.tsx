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

const MainLayout: React.FC = () => {
  const { session, userRole, isLoading, profileError } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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

    const inAuthGroup = segments[0] === '(auth)';
    const inClientGroup = segments[0] === '(client)';
    const inMerchantGroup = segments[0] === '(merchant)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
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
        return;
      }

      if (userRole === 'client' && (inMerchantGroup || (inAuthGroup && !isInSignupFlow))) {
        router.replace('/(client)/home');
        return;
      }

      if (userRole === 'merchant' && (inClientGroup || (inAuthGroup && !isInSignupFlow))) {
        router.replace('/(merchant)/dashboard');
        return;
      }

      if (inAuthGroup && !userRole) {
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