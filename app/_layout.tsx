import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useMontserrat, Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { useFonts as useRoboto, Roboto_400Regular, Roboto_500Medium } from '@expo-google-fonts/roboto';
import { useFonts as useMaterialSymbols, MaterialSymbolsOutlined_400Regular } from '@expo-google-fonts/material-symbols-outlined';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../components/ui/ToastProvider';
import * as Sentry from '@sentry/react-native';
import { initMonitoring } from '../lib/monitoring';
import { useAuthRouting } from '../lib/hooks/useAuthRouting';
import { useDeepLinkHandler } from '../lib/hooks/useDeepLinkHandler';
import { useSignupCheck } from '../lib/hooks/useSignupCheck';

// Inicializa monitoramento ANTES de qualquer outra coisa
// Isso garante que erros sejam capturados desde o início
initMonitoring();

// Impede o splash screen de sumir automaticamente
SplashScreen.preventAutoHideAsync();

const MainLayout: React.FC = () => {
  // Usa hooks customizados para gerenciar roteamento, deep links e verificação de cadastro
  useAuthRouting();
  useDeepLinkHandler();
  useSignupCheck();


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

export default Sentry.wrap(RootLayout);