import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../lib/logger';

/**
 * Rota de callback OAuth
 * 
 * Esta tela mostra loading enquanto o OAuth é processado pelo useDeepLinkHandler.
 * O deep link é processado automaticamente pelo hook global.
 * Esta rota existe apenas para evitar o erro "Unmatched Route" no Expo Router.
 * 
 * Quando a sessão for estabelecida (pelo useDeepLinkHandler), o useAuthRouting
 * redirecionará para a home correta.
 */
export default function AuthCallback() {
    const router = useRouter();
    const { session, isLoading } = useAuth();

    useEffect(() => {
        if (__DEV__) {
            logger.debug('[AuthCallback] Tela de callback montada, aguardando processamento pelo useDeepLinkHandler');
        }
    }, []);

    // Quando a sessão for estabelecida, o useAuthRouting fará o redirecionamento
    // Aqui só fazemos fallback para login caso demore demais
    useEffect(() => {
        const fallbackTimeout = setTimeout(() => {
            if (!session && !isLoading) {
                if (__DEV__) {
                    logger.warn('[AuthCallback] Timeout de 15s sem sessão - redirecionando para login');
                }
                router.replace('/(auth)/login');
            }
        }, 15000);

        return () => clearTimeout(fallbackTimeout);
    }, [session, isLoading, router]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#007AFF" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F4F6F9',
    },
});
