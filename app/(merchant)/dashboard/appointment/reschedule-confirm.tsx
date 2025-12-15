import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import AppHeader from '../../../../components/layout/AppHeader';
import ScreenContainer from '../../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../../components/CustomButton';
import { Icon } from '../../../../components/ui/Icon';
import RescheduleSuccessModal from '../../../../components/appointments/RescheduleSuccessModal';
import { checkAppointmentConflicts, calculateAppointmentPrice } from '../../../../lib/utils';
import { useSafeGoBack } from '../../../../lib/router-utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  client_notes: string | null;
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
  business_id?: string;
};

const MerchantRescheduleFinalConfirmScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    appointmentId: string; 
    date: string; 
    time: string; 
    justification?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const safeGoBack = useSafeGoBack('/(merchant)/dashboard');

  useEffect(() => {
    loadAppointmentData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setShowSuccessModal(false);
    }, [])
  );

  const loadAppointmentData = async () => {
    try {
      setLoading(true);

      if (!params.appointmentId || !params.date || !params.time) {
        Alert.alert('Erro', 'Parâmetros inválidos');
        router.replace('/(merchant)/dashboard');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (businessError || !businessData) {
        if (businessError && businessError.code !== 'PGRST116') {
          console.error('Erro ao buscar negócio:', businessError);
        }
        router.replace('/(merchant)/dashboard');
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
        .eq('id', params.appointmentId)
        .eq('business_id', businessData.id)
        .single();

      if (error || !appointmentData) {
        console.error('Erro ao buscar agendamento:', error);
        Alert.alert('Erro', 'Não foi possível carregar o agendamento.');
        router.replace('/(merchant)/dashboard');
        return;
      }

      setAppointment(appointmentData as Appointment);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao carregar os dados.');
      router.replace('/(merchant)/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!appointment || !params.date || !params.time) return;

    try {
      setSubmitting(true);

      const dateString = params.date;
      const [hours, minutes] = params.time.split(':').map(Number);
      
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
      const { hasConflict, error: conflictError } = await checkAppointmentConflicts(
        appointment.business_id ?? appointment.business.id,
        startTime.toISOString(),
        endTime.toISOString(),
        params.appointmentId
      );

      if (conflictError) {
        console.error('[RescheduleConfirm] Erro ao verificar conflitos:', conflictError);
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
        .eq('id', params.appointmentId)
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
          appointment_id: parseInt(params.appointmentId),
          requested_by: user.id,
          requested_by_type: 'merchant',
          original_start_time: originalAppointment.start_time,
          original_end_time: originalAppointment.end_time,
          new_start_time: startTime.toISOString(),
          new_end_time: endTime.toISOString(),
          justification: params.justification || null,
          status: 'pending',
        })
        .select()
        .single();

      if (rescheduleError) {
        console.error('[RescheduleConfirm] Erro ao criar reagendamento:', rescheduleError);
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
        .eq('appointment_id', parseInt(params.appointmentId))
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
        .eq('id', params.appointmentId);

      if (error) {
        console.error('[RescheduleConfirm] Erro ao atualizar status do agendamento:', error);
        Alert.alert('Erro', 'Não foi possível atualizar o status do agendamento. Tente novamente.');
        setSubmitting(false);
        return;
      }

      // Mostrar modal de sucesso
      setSubmitting(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('[RescheduleConfirm] Erro ao processar reagendamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao processar o reagendamento.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            title="Confirmar Reagendamento"
            showBackButton={true}
            onPressBack={safeGoBack}
          />
        }
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000E3D" />
        </View>
      </ScreenContainer>
    );
  }

  if (!appointment || !params.date || !params.time) {
    return null;
  }

  const price = calculateAppointmentPrice(
    appointment.service.price,
    appointment.service.price_type as 'fixed' | 'hourly',
    appointment.service.duration_minutes
  );

  const getPaymentMethodIcon = () => {
    const method = appointment.payment_method.toLowerCase();
    if (method === 'card' || method === 'credit_card' || method === 'debit_card') {
      return <Icon name="credit-card" size={24} color="#000E3D" />;
    }
    if (method === 'cash' || method === 'dinheiro') {
      return <Icon name="payments" size={24} color="#000E3D" />;
    }
    return <Icon family="FontAwesome6" name="pix" size={24} color="#000E3D" />;
  };

  const getPaymentMethodLabel = () => {
    const method = appointment.payment_method.toLowerCase();
    if (method === 'card' || method === 'credit_card' || method === 'debit_card') {
      return 'Cartão';
    }
    if (method === 'cash' || method === 'dinheiro') {
      return 'Dinheiro';
    }
    return 'PIX';
  };

  // Formatar nova data e horário
  const newDate = new Date(params.date);
  const [hours, minutes] = params.time.split(':').map(Number);
  const newStartTime = new Date(newDate);
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
  
  const newEndTime = new Date(newStartTime);
  newEndTime.setMinutes(newEndTime.getMinutes() + durationMinutes);

  const formatDateLong = (date: Date) => {
    return format(date, "d 'de' MMMM", { locale: ptBR });
  };

  const formatTimeRange = () => {
    const startStr = format(newStartTime, 'HH:mm');
    const endStr = format(newEndTime, 'HH:mm');
    return `${startStr} - ${endStr}`;
  };

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      header={
        <AppHeader 
          title="Confirmar Reagendamento"
          showBackButton={true}
          onPressBack={safeGoBack}
        />
      }
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            compact
            title="Enviar"
            onPress={handleSubmit}
            disabled={submitting}
            variant="primary"
            isLoading={submitting}
          />
        </View>
      }
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
          <Icon name="calendar_clock" family="MaterialSymbols" size={24} color="#000E3D" />
          <View style={styles.newAppointmentContent}>
            <Text style={styles.newAppointmentDate}>
              {formatDateLong(newDate)}
            </Text>
            <Text style={styles.newAppointmentTime}>
              {formatTimeRange()}
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
            {params.justification || 'Nenhuma justificativa fornecida'}
          </Text>
        </View>
      </View>

      {/* Success Modal */}
      <RescheduleSuccessModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          if (params.appointmentId) {
            router.replace(`/(merchant)/dashboard/appointment/${params.appointmentId}` as never);
          } else {
            router.replace('/(merchant)/dashboard' as never);
          }
        }}
      />
    </ScreenContainer>
  );
};

export default MerchantRescheduleFinalConfirmScreen;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    justifyContent: 'flex-start',
  },
  detailsCard: {
    backgroundColor: '#FEFEFE',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 20,
    paddingBottom: 20,
    paddingTop: 20,
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
    gap: 16,
    overflow: 'visible',
  },
  headerSection: {
    gap: 8,
  },
  rescheduleLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  serviceNameHeader: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  newAppointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#EBEFFF',
    borderWidth: 2,
    borderColor: '#000E3D',
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
    color: '#000E3D',
  },
  newAppointmentTime: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  section: {
    gap: 6,
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
    fontWeight: '500',
    color: '#0F0F0F',
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  justificationSection: {
    gap: 6,
  },
  justificationLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  justificationText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  footerContainer: {
    backgroundColor: '#FEFEFE',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
});
