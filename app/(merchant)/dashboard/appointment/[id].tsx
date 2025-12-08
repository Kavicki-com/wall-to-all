import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { IconBack, IconCheckCircle, IconPix, IconCreditCard, IconCash } from '../../../../lib/icons';
import { MerchantTopBar } from '../../../../components/MerchantTopBar';
import { format, parseISO, isToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateAppointmentPrice } from '../../../../lib/utils';

type AppointmentReschedule = {
  id: number;
  appointment_id: number;
  requested_by: string;
  requested_by_type: 'client' | 'merchant';
  original_start_time: string;
  original_end_time: string;
  new_start_time: string;
  new_end_time: string;
  justification?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
};

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  observations: string | null;
  service: {
    id: string;
    name: string;
    price: number;
    price_type: string;
    duration_minutes: number;
    photos: string[] | string | null;
  };
  client: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
  business: {
    id: string;
    business_name: string;
    address: string | null;
  };
  pending_reschedules?: AppointmentReschedule[];
};

const AppointmentDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  useEffect(() => {
    loadAppointment();
  }, [params.id]);

  const loadAppointment = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('Usuário não autenticado');
        router.back();
        return;
      }

      // Buscar business_profile do lojista
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!businessData) {
        console.error('Negócio não encontrado');
        router.back();
        return;
      }

      // Buscar agendamento
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
        .eq('id', params.id)
        .eq('business_id', businessData.id)
        .single();

      if (error) {
        console.error('Erro ao buscar agendamento:', error);
        if (error.code === 'PGRST116') {
          Alert.alert('Agendamento não encontrado', 'Este agendamento não existe ou foi removido.');
        } else {
          Alert.alert('Erro', 'Não foi possível carregar o agendamento. Verifique sua conexão e tente novamente.');
        }
        router.back();
      } else if (appointmentData) {
        // Buscar reagendamentos pendentes
        const { data: pendingReschedules } = await supabase
          .from('appointment_reschedules')
          .select('*')
          .eq('appointment_id', appointmentData.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        setAppointment({
          ...appointmentData,
          pending_reschedules: pendingReschedules || [],
        } as Appointment);
      }
    } catch (error) {
      console.error('Erro ao carregar agendamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao carregar o agendamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!appointment) return;

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        Alert.alert(
          'Erro',
          'Não foi possível atualizar o status do agendamento. Verifique sua conexão e tente novamente.'
        );
      } else {
        loadAppointment();
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao atualizar o status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirm = () => {
    Alert.alert(
      'Confirmar Agendamento',
      'Deseja confirmar este agendamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => handleStatusUpdate('confirmed') },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Agendamento',
      'Deseja cancelar este agendamento? Esta ação não pode ser desfeita.',
      [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim, cancelar', style: 'destructive', onPress: () => handleStatusUpdate('cancelled') },
      ],
    );
  };

  const handleReschedule = () => {
    if (!appointment) return;
    router.push({
      pathname: '/(merchant)/dashboard/appointment/reschedule',
      params: {
        appointmentId: appointment.id,
      },
    });
  };

  const handleRescheduleSubmit = async () => {
    if (!appointment || !selectedRescheduleDate || !selectedRescheduleTime || !rescheduleJustification.trim()) {
      Alert.alert('Atenção', 'Por favor, preencha todos os campos.');
      return;
    }

    try {
      setUpdating(true);

      const newDate = format(selectedRescheduleDate, 'yyyy-MM-dd');
      const [hours, minutes] = selectedRescheduleTime.split(':');
      const newTime = `${hours}:${minutes}:00`;

      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: newDate,
          appointment_time: newTime,
          status: 'rescheduled',
          // Adicionar justificativa nas observações ou criar campo separado
        })
        .eq('id', appointment.id);

      if (error) {
        console.error('Erro ao reagendar:', error);
        if (error.code === '23505') {
          Alert.alert('Conflito', 'Já existe um agendamento neste horário. Por favor, escolha outro horário.');
        } else {
          Alert.alert('Erro', 'Não foi possível reagendar o agendamento. Verifique sua conexão e tente novamente.');
        }
      } else {
        setShowRescheduleModal(false);
        setShowConfirmationModal(true);
        loadAppointment();
      }
    } catch (error) {
      console.error('Erro ao reagendar:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao reagendar.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAcceptReschedule = async (rescheduleId: number) => {
    if (!appointment) return;

    try {
      setUpdating(true);

      // Buscar dados do reagendamento
      const { data: rescheduleData, error: fetchError } = await supabase
        .from('appointment_reschedules')
        .select('*')
        .eq('id', rescheduleId)
        .eq('appointment_id', appointment.id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !rescheduleData) {
        Alert.alert('Erro', 'Reagendamento não encontrado ou já processado.');
        return;
      }

      // Atualizar o agendamento com os novos horários
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          start_time: rescheduleData.new_start_time,
          end_time: rescheduleData.new_end_time,
          status: 'confirmed', // Ou 'pending' dependendo do fluxo
        })
        .eq('id', appointment.id);

      if (updateError) {
        console.error('Erro ao atualizar agendamento:', updateError);
        Alert.alert('Erro', 'Não foi possível aceitar o reagendamento.');
        return;
      }

      // Marcar reagendamento como aceito
      const { error: acceptError } = await supabase
        .from('appointment_reschedules')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', rescheduleId);

      if (acceptError) {
        console.error('Erro ao marcar reagendamento como aceito:', acceptError);
      }

      // Cancelar outros reagendamentos pendentes do mesmo agendamento
      await supabase
        .from('appointment_reschedules')
        .update({
          status: 'cancelled',
        })
        .eq('appointment_id', appointment.id)
        .eq('status', 'pending')
        .neq('id', rescheduleId);

      loadAppointment();
      Alert.alert('Sucesso', 'Reagendamento aceito com sucesso.');
    } catch (error) {
      console.error('Erro ao aceitar reagendamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao aceitar o reagendamento.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectReschedule = async (rescheduleId: number, reason?: string) => {
    if (!appointment) return;

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('appointment_reschedules')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_reason: reason || null,
        })
        .eq('id', rescheduleId)
        .eq('appointment_id', appointment.id);

      if (error) {
        console.error('Erro ao rejeitar reagendamento:', error);
        Alert.alert('Erro', 'Não foi possível rejeitar o reagendamento.');
        return;
      }

      loadAppointment();
      Alert.alert('Sucesso', 'Reagendamento rejeitado.');
    } catch (error) {
      console.error('Erro ao rejeitar reagendamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao rejeitar o reagendamento.');
    } finally {
      setUpdating(false);
    }
  };

  // Gerar próximas datas disponíveis (próximos 30 dias)
  const generateAvailableDates = () => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  // Gerar horários disponíveis (8h às 18h, intervalos de 1 hora)
  const generateAvailableTimes = () => {
    const times: string[] = [];
    for (let hour = 8; hour < 18; hour++) {
      times.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return times;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      completed: 'Concluído',
      rescheduled: 'Reagendado',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: '#FFA500',
      confirmed: '#17723F',
      cancelled: '#E5102E',
      completed: '#474747',
      rescheduled: '#000E3D',
    };
    return colorMap[status] || '#474747';
  };

  const getPaymentMethodLabel = (method: string) => {
    const methodMap: Record<string, string> = {
      pix: 'PIX',
      card: 'Cartão',
      cash: 'Dinheiro',
    };
    return methodMap[method] || method;
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'pix':
        return <IconPix size={24} color="#000E3D" />;
      case 'card':
        return <IconCreditCard size={24} color="#000E3D" />;
      case 'cash':
        return <IconCash size={24} color="#000E3D" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.container}>
        <MerchantTopBar showBack onBackPress={() => router.back()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Agendamento não encontrado.</Text>
        </View>
      </View>
    );
  }

  // Processar imagens do serviço
  let imagesArray: string[] = [];
  if (appointment.service.photos) {
    if (typeof appointment.service.photos === 'string') {
      try {
        imagesArray = JSON.parse(appointment.service.photos);
      } catch {
        imagesArray = [appointment.service.photos];
      }
    } else if (Array.isArray(appointment.service.photos)) {
      imagesArray = appointment.service.photos;
    }
  }
  const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

  const appointmentDate = new Date(appointment.start_time);
  const isTodayDate = isToday(appointmentDate);
  const dateLabel = isTodayDate
    ? 'Hoje'
    : format(appointmentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const timeLabel = format(appointmentDate, 'HH:mm');

  return (
    <View style={styles.container}>
      <MerchantTopBar showBack onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Appointment Details Card */}
        <View style={styles.detailsCard}>
          {/* Header: Date and Time */}
          <View style={styles.headerSection}>
            <Text style={styles.dateTimeHeader}>
              {dateLabel} - {timeLabel}
            </Text>
            <Text style={styles.serviceNameHeader}>{appointment.service.name}</Text>
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
              {getPaymentMethodIcon(appointment.payment_method)}
              <View style={styles.paymentMethodInfo}>
                <Text style={styles.paymentMethodLabel}>
                  {getPaymentMethodLabel(appointment.payment_method)}
                </Text>
                <Text style={styles.paymentMethodPrice}>
                  R$ {calculateAppointmentPrice(
                    appointment.service.price,
                    appointment.service.price_type as 'fixed' | 'hourly',
                    appointment.service.duration_minutes
                  ).toFixed(2).replace('.', ',')}
                </Text>
              </View>
            </View>
          </View>

          {/* Observations */}
          {appointment.observations && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Observações do cliente:</Text>
              <Text style={styles.observations}>{appointment.observations}</Text>
            </View>
          )}

          {/* Pending Reschedules */}
          {appointment.pending_reschedules && appointment.pending_reschedules.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Solicitações de reagendamento:</Text>
              {appointment.pending_reschedules.map((reschedule) => {
                const originalDate = new Date(reschedule.original_start_time);
                const newDate = new Date(reschedule.new_start_time);
                const originalTime = format(originalDate, 'HH:mm');
                const newTime = format(newDate, 'HH:mm');
                const originalEndTime = format(new Date(reschedule.original_end_time), 'HH:mm');
                const newEndTime = format(new Date(reschedule.new_end_time), 'HH:mm');

                return (
                  <View key={reschedule.id} style={styles.rescheduleCard}>
                    <View style={styles.rescheduleHeader}>
                      <Text style={styles.rescheduleTitle}>Solicitação de Reagendamento</Text>
                      <Text style={styles.rescheduleDate}>
                        {format(new Date(reschedule.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </Text>
                    </View>

                    <View style={styles.rescheduleTimes}>
                      <View style={styles.rescheduleTimeItem}>
                        <Text style={styles.rescheduleTimeLabel}>Horário atual:</Text>
                        <Text style={styles.rescheduleTimeValue}>
                          {format(originalDate, 'dd/MM/yyyy', { locale: ptBR })} - {originalTime} às {originalEndTime}
                        </Text>
                      </View>
                      <View style={styles.rescheduleTimeItem}>
                        <Text style={styles.rescheduleTimeLabel}>Novo horário solicitado:</Text>
                        <Text style={styles.rescheduleTimeValue}>
                          {format(newDate, 'dd/MM/yyyy', { locale: ptBR })} - {newTime} às {newEndTime}
                        </Text>
                      </View>
                    </View>

                    {reschedule.justification && (
                      <View style={styles.rescheduleJustification}>
                        <Text style={styles.rescheduleJustificationLabel}>Justificativa:</Text>
                        <Text style={styles.rescheduleJustificationText}>{reschedule.justification}</Text>
                      </View>
                    )}

                    <View style={styles.rescheduleActions}>
                      <TouchableOpacity
                        style={[styles.rescheduleActionButton, styles.rejectButton]}
                        onPress={() => {
                          Alert.alert(
                            'Rejeitar Reagendamento',
                            'Deseja rejeitar esta solicitação de reagendamento?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Rejeitar',
                                style: 'destructive',
                                onPress: () => handleRejectReschedule(reschedule.id),
                              },
                            ]
                          );
                        }}
                        disabled={updating}
                      >
                        <Text style={styles.rejectButtonText}>Rejeitar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rescheduleActionButton, styles.acceptButton]}
                        onPress={() => {
                          Alert.alert(
                            'Aceitar Reagendamento',
                            'Deseja aceitar esta solicitação de reagendamento? O horário do agendamento será atualizado.',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Aceitar',
                                onPress: () => handleAcceptReschedule(reschedule.id),
                              },
                            ]
                          );
                        }}
                        disabled={updating}
                      >
                        <Text style={styles.acceptButtonText}>Aceitar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
          <>
            {appointment.status === 'pending' && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                disabled={updating}
              >
                <Text style={styles.confirmButtonText}>Confirmar agendamento</Text>
                <IconCheckCircle size={24} color="#000E3D" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.suggestButton}
              onPress={handleReschedule}
              disabled={updating}
            >
              <Text style={styles.suggestButtonText}>Sugerir novo agendamento</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Modal de Confirmação */}
      <Modal
        visible={showConfirmationModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmationModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModalContent}>
            <IconCheckCircle size={67} color="#17723F" />
            <Text style={styles.confirmationTitle}>Sugestão de novo horário enviada</Text>
            <Text style={styles.confirmationMessage}>
              Aguarde o seu cliente confirmar a sua sugestão
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowConfirmationModal(false);
                router.back();
              }}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppointmentDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
    marginTop: 70,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  detailsCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    gap: 24,
  },
  headerSection: {
    gap: 8,
  },
  dateTimeHeader: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  serviceNameHeader: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
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
    color: '#0F0F0F',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FEFEFE',
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
    color: '#0F0F0F',
  },
  paymentMethodPrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  observations: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    lineHeight: 24,
  },
  rescheduleCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 16,
  },
  rescheduleHeader: {
    gap: 4,
  },
  rescheduleTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  rescheduleDate: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#666666',
  },
  rescheduleTimes: {
    gap: 12,
  },
  rescheduleTimeItem: {
    gap: 4,
  },
  rescheduleTimeLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#666666',
  },
  rescheduleTimeValue: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  rescheduleJustification: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  rescheduleJustificationLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#666666',
  },
  rescheduleJustificationText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    lineHeight: 20,
  },
  rescheduleActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  rescheduleActionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#17723F',
  },
  acceptButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  rejectButton: {
    backgroundColor: '#E5102E',
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  suggestButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModalContent: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 24,
    gap: 16,
  },
  confirmationTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    textAlign: 'center',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    width: 256,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});

