/**
 * Push Notifications — Registro, permissões e handlers
 *
 * Usa expo-notifications para push nativo via APNs (iOS) e FCM (Android).
 * Tokens são armazenados na tabela push_tokens do Supabase.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from './logger';
import { router } from 'expo-router';

// Configurar como as notificações são exibidas quando o app está em foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Registra o dispositivo para receber push notifications.
 * Pede permissão ao usuário se necessário.
 * @returns O Expo Push Token ou null se falhar
 */
export async function registerForPushNotifications(): Promise<string | null> {
    // Push só funciona em dispositivos físicos
    if (!Device.isDevice) {
        logger.warn('[Push] Notificações push não funcionam em emulador/simulador');
        return null;
    }

    try {
        // Verificar permissão existente
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Se não tem permissão, pedir
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            logger.warn('[Push] Permissão de notificação negada pelo usuário');
            return null;
        }

        // Configurar canal de notificação no Android
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Wall to All',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#000E3D',
                sound: 'default',
            });
        }

        // Obter o Expo Push Token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            logger.error('[Push] EAS Project ID não encontrado no app.json');
            return null;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        logger.info('[Push] Token registrado:', tokenData.data);
        return tokenData.data;
    } catch (error) {
        logger.error('[Push] Erro ao registrar para push:', error);
        return null;
    }
}

/**
 * Salva o push token no Supabase (upsert).
 * @param userId - ID do usuário autenticado
 * @param token - Expo Push Token
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
    try {
        const deviceType = Platform.OS; // 'ios' | 'android'

        const { error } = await supabase
            .from('push_tokens')
            .upsert(
                {
                    user_id: userId,
                    token,
                    device_type: deviceType,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'user_id,token',
                }
            );

        if (error) {
            logger.error('[Push] Erro ao salvar token:', error);
            return;
        }

        logger.info('[Push] Token salvo no Supabase para user:', userId);
    } catch (error) {
        logger.error('[Push] Erro ao salvar token (catch):', error);
    }
}

/**
 * Remove o push token do Supabase (no logout).
 * @param token - Expo Push Token a remover
 */
export async function removePushToken(token: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('push_tokens')
            .delete()
            .eq('token', token);

        if (error) {
            logger.error('[Push] Erro ao remover token:', error);
            return;
        }

        logger.info('[Push] Token removido do Supabase');
    } catch (error) {
        logger.error('[Push] Erro ao remover token (catch):', error);
    }
}

/**
 * Configurar handler de tap na notificação.
 * Navega para a tela relevante baseado nos dados da notificação.
 */
export function setupNotificationResponseHandler(): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        logger.debug('[Push] Notificação clicada, dados:', data);

        try {
            const type = data?.type as string | undefined;
            const appointmentId = data?.appointment_id;

            if (!type) return;

            // Navegar para a tela correta baseado no tipo de notificação
            switch (type) {
                case 'appointment_requested':
                case 'reschedule_requested':
                case 'reschedule_suggested':
                    // Merchant recebe → ir para dashboard
                    router.push('/(merchant)/dashboard' as never);
                    break;

                case 'appointment_confirmed':
                case 'appointment_cancelled':
                case 'reschedule_accepted':
                case 'reschedule_rejected':
                    // Client recebe → ir para detalhes do agendamento
                    if (appointmentId) {
                        router.push(`/(client)/appointments/${appointmentId}` as never);
                    } else {
                        router.push('/(client)/appointments' as never);
                    }
                    break;

                default:
                    logger.warn('[Push] Tipo de notificação desconhecido:', type);
                    break;
            }
        } catch (error) {
            logger.error('[Push] Erro ao processar tap na notificação:', error);
        }
    });
}

/**
 * Listener para notificações recebidas enquanto o app está em foreground.
 * Retorna a subscription para cleanup.
 */
export function setupNotificationReceivedHandler(
    onReceived?: () => void
): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener((notification) => {
        logger.debug('[Push] Notificação recebida em foreground:', notification.request.content.title);
        // Atualizar contagem de notificações não lidas
        onReceived?.();
    });
}
