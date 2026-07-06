import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, NativeModules } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/ui/Icon';
import { colors } from '../lib/theme';
import { logger } from '../lib/logger';

type NetworkState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

type NetInfoLike = {
  addEventListener: (listener: (state: NetworkState) => void) => () => void;
  fetch: () => Promise<NetworkState>;
};

let cachedNetInfo: NetInfoLike | null | undefined;

export const getNetInfo = (): NetInfoLike | null => {
  if (cachedNetInfo !== undefined) {
    return cachedNetInfo;
  }

  if (!NativeModules.RNCNetInfo) {
    cachedNetInfo = null;

    if (__DEV__) {
      logger.warn(
        'NetInfo nativo ausente neste build; seguindo sem monitoramento de conectividade.',
      );
    }

    return cachedNetInfo;
  }

  try {
    const module = require('@react-native-community/netinfo');
    const resolved = (module?.default ?? module) as Partial<NetInfoLike>;

    if (typeof resolved?.addEventListener !== 'function' || typeof resolved?.fetch !== 'function') {
      cachedNetInfo = null;
      return cachedNetInfo;
    }

    cachedNetInfo = resolved as NetInfoLike;
    return cachedNetInfo;
  } catch (error) {
    cachedNetInfo = null;

    if (__DEV__) {
      logger.warn('NetInfo indisponivel; seguindo sem monitoramento de conectividade.', error);
    }

    return cachedNetInfo;
  }
};

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
});

export const useNetwork = () => useContext(NetworkContext);

/**
 * Banner exibido quando o dispositivo está offline.
 * Usa SafeArea para posicionar abaixo da status bar.
 */
const OfflineBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -120,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          paddingTop: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Icon name="wifi-off" size={16} color={colors.white} />
      <Text style={styles.bannerText}>Sem conexão com a internet</Text>
    </Animated.View>
  );
};

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Iniciar como conectado para evitar flash falso no iOS
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const hasReceivedFirstUpdate = useRef(false);

  useEffect(() => {
    const netInfo = getNetInfo();

    if (!netInfo) {
      return;
    }

    const unsubscribe = netInfo.addEventListener((state: NetworkState) => {
      // Ignora o primeiro callback se reportar desconectado
      // (iOS/Expo Go pode dar false-negative no boot)
      if (!hasReceivedFirstUpdate.current) {
        hasReceivedFirstUpdate.current = true;

        // Se o primeiro report diz "desconectado", verifica de novo após delay
        if (!state.isConnected) {
          setTimeout(() => {
            netInfo.fetch().then((freshState) => {
              setIsConnected(freshState.isConnected ?? true);
              setIsInternetReachable(freshState.isInternetReachable);
            });
          }, 2000);
          return;
        }
      }

      setIsConnected(state.isConnected ?? true);
      setIsInternetReachable(state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  const showBanner = !isConnected;

  return (
    <NetworkContext.Provider value={{ isConnected, isInternetReachable }}>
      <View style={{ flex: 1 }}>
        <OfflineBanner visible={showBanner} />
        {children}
      </View>
    </NetworkContext.Provider>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#333',
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Roboto_400Regular',
  },
});
