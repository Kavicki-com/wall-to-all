import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import {
  fetchNotifications,
  markNotificationAsRead,
  clearAllNotifications,
  Notification,
} from '../../lib/notifications';
import { Icon } from '../ui/Icon';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onNotificationsUpdated?: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onNotificationsUpdated,
}) => {
  const router = useRouter();
  const { session, userRole } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (visible && session?.user?.id) {
      loadNotifications();
    }
  }, [visible, session?.user?.id]);

  const loadNotifications = async () => {
    if (!session?.user?.id) {
      console.warn('loadNotifications: Usuário não autenticado');
      setNotifications([]);
      return;
    }

    try {
      setLoading(true);
      console.log('Carregando notificações para usuário:', session.user.id);
      
      // Buscar todas as notificações relevantes (solicitações e respostas)
      const data = await fetchNotifications(session.user.id, {
        types: [
          'reschedule_requested',
          'reschedule_suggested',
          'appointment_requested',
          'reschedule_accepted',
          'reschedule_rejected',
          'appointment_confirmed',
          'appointment_cancelled',
        ],
      });
      
      console.log('Notificações carregadas:', data.length);
      if (data.length > 0) {
        console.log('Primeira notificação:', JSON.stringify(data[0], null, 2));
      }
      setNotifications(data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.related_appointment_id) return;

    // Marcar como lida
    if (notification.id && !notification.read) {
      await markNotificationAsRead(notification.id);
      // Atualizar estado local
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
      onNotificationsUpdated?.();
    }

    // Navegar para o agendamento
    const appointmentId = notification.related_appointment_id?.toString();
    if (!appointmentId) return;

    if (userRole === 'merchant') {
      router.push(`/(merchant)/dashboard/appointment/${appointmentId}`);
    } else if (userRole === 'client') {
      router.push(`/(client)/appointments/${appointmentId}`);
    }

    onClose();
  };

  const handleClearAll = async () => {
    if (!session?.user?.id) return;

    try {
      setClearing(true);
      await clearAllNotifications(session.user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onNotificationsUpdated?.();
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
    } finally {
      setClearing(false);
    }
  };

  const formatNotificationDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '';
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'reschedule_requested':
        return 'Solicitação de Reagendamento';
      case 'reschedule_suggested':
        return 'Reagendamento Sugerido';
      case 'appointment_requested':
        return 'Solicitação de Agendamento';
      case 'reschedule_accepted':
        return 'Reagendamento Aceito';
      case 'reschedule_rejected':
        return 'Reagendamento Rejeitado';
      case 'appointment_confirmed':
        return 'Agendamento Confirmado';
      case 'appointment_cancelled':
        return 'Agendamento Cancelado';
      default:
        return 'Notificação';
    }
  };

  const hasUnreadNotifications = notifications.some((n) => !n.read);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlayTouchable} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
              {/* Handle Indicator */}
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              {/* Header - Fixo no topo */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Notificações</Text>
                {hasUnreadNotifications && (
                  <TouchableOpacity
                    onPress={handleClearAll}
                    disabled={clearing}
                    style={styles.clearButton}
                  >
                    {clearing ? (
                      <ActivityIndicator size="small" color="#5C9EFF" />
                    ) : (
                      <Text style={styles.clearButtonText}>Limpar todas</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Lista de Notificações - Scrollável */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#5C9EFF" />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nenhuma notificação</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: 24 + insets.bottom },
                  ]}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  nestedScrollEnabled={true}
                >
                  {notifications.map((notification, index) => (
                    <View key={notification.id}>
                      <TouchableOpacity
                        style={styles.notificationItem}
                        onPress={() => handleNotificationPress(notification)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.notificationContent}>
                          <View style={styles.notificationHeader}>
                            {!notification.read && (
                              <View style={styles.unreadBullet} />
                            )}
                            <Text style={styles.notificationMessage}>
                              {notification.message}
                            </Text>
                          </View>
                          <View style={styles.notificationFooter}>
                            {!notification.read && (
                              <Text style={styles.unreadLabel}>Recebida</Text>
                            )}
                            <Text style={styles.notificationDate}>
                              {formatNotificationDate(notification.created_at)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      {index < notifications.length - 1 && (
                        <View style={styles.divider} />
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    width: '100%',
    height: SCREEN_HEIGHT * 0.8, // 80% da altura da tela
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  clearButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#5C9EFF',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#999999',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },
  notificationItem: {
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  notificationContent: {
    gap: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9D4EDD',
  },
  notificationMessage: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    flex: 1,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginLeft: 0,
  },
  notificationDate: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#999999',
  },
  unreadLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#5C9EFF',
  },
});

export default NotificationModal;

