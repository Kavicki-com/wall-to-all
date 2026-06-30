import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';
import { getUnreadCount } from '../lib/notifications';
import {
    registerForPushNotifications,
    savePushToken,
    removePushToken,
    setupNotificationResponseHandler,
    setupNotificationReceivedHandler,
} from '../lib/pushNotifications';

interface NotificationContextType {
    unreadCount: number;
    refreshNotifications: () => Promise<void>;
    pushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadCount: 0,
    refreshNotifications: async () => { },
    pushToken: null,
});

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { session } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [pushToken, setPushToken] = useState<string | null>(null);
    const pushTokenRef = useRef<string | null>(null);

    const fetchUnreadCount = useCallback(async () => {
        if (!session?.user?.id) return;
        try {
            const count = await getUnreadCount(session.user.id);
            setUnreadCount(count);
        } catch (error) {
            logger.error('Erro ao buscar contagem de notificações:', error);
        }
    }, [session?.user?.id]);

    // Registrar para push notifications quando o usuário faz login
    useEffect(() => {
        if (!session?.user?.id) {
            // Usuário deslogou — limpar token
            if (pushTokenRef.current) {
                removePushToken(pushTokenRef.current);
                pushTokenRef.current = null;
                setPushToken(null);
            }
            return;
        }

        let isMounted = true;

        const registerPush = async () => {
            try {
                const token = await registerForPushNotifications();
                if (token && isMounted) {
                    pushTokenRef.current = token;
                    setPushToken(token);
                    await savePushToken(session.user.id, token);
                }
            } catch (error) {
                logger.error('[Push] Erro ao registrar push:', error);
            }
        };

        registerPush();

        return () => {
            isMounted = false;
        };
    }, [session?.user?.id]);

    // Setup notification handlers (tap + foreground)
    useEffect(() => {
        const responseSubscription = setupNotificationResponseHandler();
        const receivedSubscription = setupNotificationReceivedHandler(() => {
            fetchUnreadCount();
        });

        return () => {
            responseSubscription.remove();
            receivedSubscription.remove();
        };
    }, [fetchUnreadCount]);

    // Supabase Realtime para atualização de notificações
    useEffect(() => {
        if (session?.user?.id) {
            fetchUnreadCount();

            // Subscrever para atualizações em tempo real
            const channel = supabase
                .channel('public:notifications')
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Escutar todos os eventos (INSERT, UPDATE)
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${session.user.id}`,
                    },
                    (payload) => {
                        logger.debug('Evento de notificação recebido:', payload);
                        fetchUnreadCount();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } else {
            setUnreadCount(0);
        }
    }, [session?.user?.id, fetchUnreadCount]);

    return (
        <NotificationContext.Provider value={{ unreadCount, refreshNotifications: fetchUnreadCount, pushToken }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);
