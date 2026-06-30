import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../../lib/supabase';
import { CustomButton } from '../../../../components/CustomButton';
import { Icon } from '../../../../components/ui/Icon';
import RescheduleSuccessModal from '../../../../components/appointments/RescheduleSuccessModal';
import { checkAppointmentConflicts, calculateAppointmentPrice } from '../../../../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { notifyRescheduleSuggested } from '../../../../lib/notifications';
import { logger } from '../../../../lib/logger';
import { MerchantDetailAppointment } from '../../../../lib/types';
import { colors } from '../../../../lib/theme';

type Appointment = MerchantDetailAppointment;

interface RescheduleConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  appointmentId: string;
  date: string;
  time: string;
  justification?: string;
  onSuccess?: () => void;
}

const RescheduleConfirmModal: React.FC<RescheduleConfirmModalProps> = ({
  visible,
  onClose,
  appointmentId,
  date,
  time,
  justification,
  onSuccess,
}) => {


  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  useEffect(() => {

    if (visible) {
      loadAppointmentData();
      setShowSuccessModal(false);
    } else {

      setLoading(true);
      setAppointment(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadAppointmentData = async () => {
    try {
      setLoading(true);


      if (!appointmentId || !date || !time) {
        // Não fechar o modal imediatamente - apenas logar o erro

        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (businessError || !businessData) {
        if (businessError && businessError.code !== 'PGRST116') {
          logger.error('Erro ao buscar negócio:', businessError);
        }

        setLoading(false);
        return;
      }

      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          service:services(id, name, price, price_type, duration_minutes, photos),
          client:profiles!appointments_client_id_fkey(id, full_name, avatar_url, email),
          business:business_profiles(id, business_name, address)
        `,
        )
        .eq('id', parseInt(appointmentId))
        .eq('business_id', businessData.id)
        .single();
      if (error || !appointmentData) {
        logger.error('Erro ao buscar agendamento:', error);

        setLoading(false);
        return;
      }

      const normalized: Appointment = {
        ...appointmentData,
        id: String(appointmentData.id),
        service: {
          ...(Array.isArray(appointmentData.service) ? appointmentData.service[0] : appointmentData.service),
          id: String((Array.isArray(appointmentData.service) ? appointmentData.service[0] : appointmentData.service).id),
        },
        client: Array.isArray(appointmentData.client) ? appointmentData.client[0] : appointmentData.client,
        business: {
          ...(Array.isArray(appointmentData.business) ? appointmentData.business[0] : appointmentData.business),
          id: String((Array.isArray(appointmentData.business) ? appointmentData.business[0] : appointmentData.business).id),
        },
        business_id: appointmentData.business_id,
        created_at: appointmentData.created_at,
      } as Appointment;
      setAppointment(normalized);
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);

      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!appointment || !date || !time) return;
    try {
      setSubmitting(true);

      const dateString = date;
      const [hours, minutes] = time.split(':').map(Number);

      // Criar start_time no formato ISO
      const startTime = new Date(`${dateString}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);

      // Calcular end_time baseado na duração do serviço
      const serviceDuration = appointment.service.duration_minutes || 60;
      let durationMinutes = serviceDuration;
      if (durationMinutes > 480) {
        // Converter se necessário (mesma lógica do reschedule.tsx)
        const convertedFromMs = Math.round(durationMinutes / 1000 / 60);
        if (convertedFromMs > 0 && convertedFromMs <= 480) {
          durationMinutes = convertedFromMs;
        } else {
          const convertedFromSeconds = Math.round(durationMinutes / 60);
          if (convertedFromSeconds > 0 && convertedFromSeconds <= 480) {
            durationMinutes = convertedFromSeconds;
          } else {
            durationMinutes = 60;
          }
        }
      }

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      // Verificar conflitos de horário antes de atualizar
      const businessId = appointment.business_id ?? appointment.business?.id;
      const { hasConflict, error: conflictError } = await checkAppointmentConflicts(
        Number(businessId),
        startTime.toISOString(),
        endTime.toISOString(),
        Number(appointmentId)
      );

      if (conflictError) {
        logger.error('[RescheduleConfirm] Erro ao verificar conflitos:', conflictError);
        Alert.alert('Erro', 'Não foi possível verificar disponibilidade do horário.');
        setSubmitting(false);
        return;
      }

      if (hasConflict) {
        Alert.alert(
          'Horário Indisponível',
          'Este horário já está ocupado. Selecione outro horário para o reagendamento.'
        );
        setSubmitting(false);
        return;
      }

      // Buscar o usuário atual
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        setSubmitting(false);
        return;
      }

      // Buscar o appointment original para obter os horários originais
      const { data: originalAppointment } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('id', parseInt(appointmentId))
        .single();

      if (!originalAppointment) {
        Alert.alert('Erro', 'Agendamento não encontrado.');
        setSubmitting(false);
        return;
      }

      // Criar registro de reagendamento na tabela appointment_reschedules
      const { data: rescheduleData, error: rescheduleError } = await supabase
        .from('appointment_reschedules')
        .insert({
          appointment_id: parseInt(appointmentId),
          requested_by: user.id,
          requested_by_type: 'merchant',
          original_start_time: originalAppointment.start_time,
          original_end_time: originalAppointment.end_time,
          new_start_time: startTime.toISOString(),
          new_end_time: endTime.toISOString(),
          justification: justification || null,
          status: 'pending',
        })
        .select()
        .single();

      if (rescheduleError) {
        logger.error('[RescheduleConfirm] Erro ao criar reagendamento:', rescheduleError);
        Alert.alert('Erro', 'Não foi possível criar o reagendamento. Tente novamente.');
        setSubmitting(false);
        return;
      }

      // Cancelar outros reagendamentos pendentes do mesmo agendamento criados pelo merchant
      // Isso garante que apenas o último reagendamento fique pendente
      await supabase
        .from('appointment_reschedules')
        .update({
          status: 'cancelled',
        })
        .eq('appointment_id', parseInt(appointmentId))
        .eq('status', 'pending')
        .eq('requested_by_type', 'merchant')
        .neq('id', rescheduleData.id);

      // Atualizar status do appointment para 'pending' para indicar que há um reagendamento pendente
      // NÃO atualizar os horários ainda - isso só acontecerá quando o cliente aceitar
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'pending',
        })
        .eq('id', parseInt(appointmentId));

      if (error) {
        logger.error('[RescheduleConfirm] Erro ao atualizar status do agendamento:', error);
        Alert.alert('Erro', 'Não foi possível atualizar o status do agendamento. Tente novamente.');
        setSubmitting(false);
        return;
      }

      // Enviar notificação para o cliente sobre o reagendamento sugerido
      if (appointment.client?.id && rescheduleData) {
        try {
          await notifyRescheduleSuggested(
            appointment.client.id,
            parseInt(appointmentId),
            rescheduleData.id,
            startTime.toISOString(),
            appointment.business.business_name
          );
        } catch (notifError) {
          logger.warn('[RescheduleConfirm] Erro ao enviar notificação de reagendamento sugerido:', notifError);
          // Não bloquear o fluxo se a notificação falhar
        }
      } else {
      }

      // Mostrar modal de sucesso
      setSubmitting(false);
      setShowSuccessModal(true);
    } catch (error) {
      logger.error('[RescheduleConfirm] Erro ao processar reagendamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao processar o reagendamento.');
      setSubmitting(false);
    }
  };
  // Formatar nova data e horário (só se appointment existir)
  let newDate: Date | null = null;
  let newStartTime: Date | null = null;
  let newEndTime: Date | null = null;
  let formatDateLong: ((date: Date) => string) | null = null;
  let formatTimeRange: (() => string) | null = null;

  if (appointment) {
    newDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    newStartTime = new Date(newDate);
    newStartTime.setHours(hours, minutes, 0, 0);

    const serviceDuration = appointment.service.duration_minutes || 60;
    let durationMinutes = serviceDuration;
    if (durationMinutes > 480) {
      const convertedFromMs = Math.round(durationMinutes / 1000 / 60);
      if (convertedFromMs > 0 && convertedFromMs <= 480) {
        durationMinutes = convertedFromMs;
      } else {
        const convertedFromSeconds = Math.round(durationMinutes / 60);
        if (convertedFromSeconds > 0 && convertedFromSeconds <= 480) {
          durationMinutes = convertedFromSeconds;
        } else {
          durationMinutes = 60;
        }
      }
    }

    newEndTime = new Date(newStartTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + durationMinutes);

    formatDateLong = (date: Date) => {
      return format(date, "d 'de' MMMM", { locale: ptBR });
    };

    formatTimeRange = () => {
      if (!newStartTime || !newEndTime) return '';
      const startStr = format(newStartTime, 'HH:mm');
      const endStr = format(newEndTime, 'HH:mm');
      return `${startStr} - ${endStr}`;
    };
  }

  const price = appointment ? calculateAppointmentPrice(
    appointment.service.price,
    appointment.service.price_type as 'fixed' | 'hourly',
    appointment.service.duration_minutes
  ) : 0;

  const getPaymentMethodIcon = () => {
    if (!appointment) return null;
    const method = appointment.payment_method.toLowerCase();
    if (method === 'card' || method === 'credit_card' || method === 'debit_card') {
      return <Icon name="credit-card" size={24} color={colors.brand} />;
    }
    if (method === 'cash' || method === 'dinheiro') {
      return <Icon name="payments" size={24} color={colors.brand} />;
    }
    return <Icon family="FontAwesome6" name="pix" size={24} color={colors.brand} />;
  };

  const getPaymentMethodLabel = () => {
    if (!appointment) return '';
    const method = appointment.payment_method.toLowerCase();
    if (method === 'card' || method === 'credit_card' || method === 'debit_card') {
      return 'Cartão';
    }
    if (method === 'cash' || method === 'dinheiro') {
      return 'Dinheiro';
    }
    return 'PIX';
  };
  if (!visible) {

    return null;
  }



  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {

        onClose();
      }}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => {
          onClose();
        }}>
          <View style={styles.overlayTouchable} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
            {/* Handle Indicator */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {loading || !appointment ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            ) : (
              <>

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: 32 + insets.bottom },
                  ]}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  alwaysBounceVertical={false}
                >
                  {/* Appointment Details Card */}
                  <View style={styles.detailsCard}>
                    {/* Header: Service Name */}
                    <View style={styles.headerSection}>
                      <Text style={styles.rescheduleLabel}>Reagendamento</Text>
                      <Text style={styles.serviceNameHeader}>{appointment.service.name}</Text>
                    </View>

                    {/* New Appointment Card */}
                    <View style={styles.newAppointmentCard}>
                      <Icon name="calendar_clock" family="MaterialSymbols" size={24} color={colors.brand} />
                      <View style={styles.newAppointmentContent}>
                        <Text style={styles.newAppointmentDate}>
                          {formatDateLong && newDate ? formatDateLong(newDate) : ''}
                        </Text>
                        <Text style={styles.newAppointmentTime}>
                          {formatTimeRange ? formatTimeRange() : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Client Info */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Cliente:</Text>
                      <View style={styles.clientInfo}>
                        {appointment.client.avatar_url ? (
                          <Image
                            source={{ uri: appointment.client.avatar_url }}
                            style={styles.clientAvatar}
                          />
                        ) : (
                          <View style={[styles.clientAvatar, styles.placeholderAvatar]} />
                        )}
                        <Text style={styles.clientName}>
                          {appointment.client.full_name || 'Cliente'}
                        </Text>
                      </View>
                    </View>

                    {/* Payment Method */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Método de pagamento:</Text>
                      <View style={styles.paymentMethodCard}>
                        {getPaymentMethodIcon()}
                        <View style={styles.paymentMethodInfo}>
                          <Text style={styles.paymentMethodLabel}>
                            {getPaymentMethodLabel()}
                          </Text>
                          <Text style={styles.paymentMethodPrice}>
                            R$ {price.toFixed(2).replace('.', ',')}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Client Observations */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Observações do cliente:</Text>
                      <Text style={styles.observations}>
                        {appointment.client_notes || 'Nenhuma observação'}
                      </Text>
                    </View>

                    {/* Justification Section */}
                    <View style={styles.justificationSection}>
                      <Text style={styles.justificationLabel}>Justificativa</Text>
                      <Text style={styles.justificationText}>
                        {justification || 'Nenhuma justificativa fornecida'}
                      </Text>
                    </View>

                    {/* Submit Button - Movido para dentro do card */}
                    <View style={styles.buttonContainer}>
                      <CustomButton
                        title="Enviar"
                        onPress={handleSubmit}
                        disabled={submitting}
                        variant="primary"
                        isLoading={submitting}
                      />
                    </View>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </TouchableWithoutFeedback>
      </View>

      {/* Success Modal */}
      <RescheduleSuccessModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onClose();
          onSuccess?.();
        }}
      />
    </Modal>
  );
};

export default RescheduleConfirmModal;

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
    backgroundColor: colors.surface,
    width: '100%',
    height: SCREEN_HEIGHT * 0.85,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    flexGrow: 1,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    padding: 20,
    paddingBottom: 20,
    paddingTop: 20,
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
    gap: 16,
  },
  headerSection: {
    gap: 8,
  },
  rescheduleLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  serviceNameHeader: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  newAppointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#EBEFFF',
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 24,
    padding: 16,
  },
  newAppointmentContent: {
    flex: 1,
    gap: 8,
  },
  newAppointmentDate: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  newAppointmentTime: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  clientName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  paymentMethodInfo: {
    flex: 1,
    gap: 8,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  paymentMethodPrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  observations: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  justificationSection: {
    gap: 6,
  },
  justificationLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  justificationText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textPrimary,
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  buttonContainer: {
    marginTop: 8,
    paddingTop: 16,
  },
});
