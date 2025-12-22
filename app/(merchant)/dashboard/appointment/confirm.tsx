import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import AppHeader from '../../../../components/layout/AppHeader';
import ScreenContainer from '../../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../../components/CustomButton';
import { Icon } from '../../../../components/ui/Icon';
import { MaterialSymbolIcon } from '../../../../components/ui/MaterialSymbolIcon';
import RescheduleSuccessModal from '../../../../components/appointments/RescheduleSuccessModal';
import { calculateAppointmentPrice } from '../../../../lib/utils';
import { useSafeGoBack } from '../../../../lib/router-utils';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '../../../../lib/logger';

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
};

const MerchantRescheduleConfirmScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId: string; date?: string; time?: string }>();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [justification, setJustification] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const safeGoBack = useSafeGoBack('/(merchant)/dashboard');

  useEffect(() => {
    loadAppointmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadAppointmentData é estável (useCallback), não precisa estar nas dependências
  }, []);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      setJustification('');
      setShowSuccessModal(false);
    }, [])
  );

  const loadAppointmentData = async () => {
    try {
      setLoading(true);

      if (!params.appointmentId) {
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
          logger.error('Erro ao buscar negócio:', businessError);
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
        logger.error('Erro ao buscar agendamento:', error);
        Alert.alert('Erro', 'Não foi possível carregar o agendamento.');
        router.replace('/(merchant)/dashboard');
        return;
      }

      setAppointment(appointmentData as Appointment);
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao carregar os dados.');
      router.replace('/(merchant)/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!justification.trim()) {
      Alert.alert('Atenção', 'Por favor, preencha a justificativa antes de continuar.');
      return;
    }

    if (!appointment) return;

    // Navegar para a tela de escolher data/horário passando a justificativa
    router.push({
      pathname: '/(merchant)/dashboard/appointment/reschedule',
      params: {
        appointmentId: params.appointmentId,
        justification: justification.trim(),
      },
    });
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

  if (!appointment) {
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

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      horizontalPadding={0}
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader 
          title="Confirmar Reagendamento"
          showBackButton={true}
          onPressBack={safeGoBack}
        />
      }
    >
        {/* Appointment Details Card */}
        <View style={styles.detailsCard}>
          {/* Header: Date and Time */}
          <View style={styles.headerSection}>
            {(() => {
              const appointmentDate = new Date(appointment.start_time);
              const isTodayDate = isToday(appointmentDate);
              const dateLabel = isTodayDate
                ? 'Hoje'
                : format(appointmentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
              const timeLabel = format(appointmentDate, 'HH:mm');
              return (
                <>
                  <Text style={styles.dateTimeHeader}>
                    {dateLabel} - {timeLabel}
                  </Text>
                  <Text style={styles.serviceNameHeader}>{appointment.service.name}</Text>
                </>
              );
            })()}
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

          {/* Observations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações do cliente:</Text>
            <Text style={styles.observations}>
              {appointment.client_notes || 'Nenhuma observação'}
            </Text>
          </View>

          {/* Justification Section */}
          <View style={styles.justificationSection}>
            <Text style={styles.justificationLabel}>Justificativa</Text>
            <View style={styles.justificationContainer}>
              <TextInput
                style={styles.justificationInput}
                value={justification}
                onChangeText={setJustification}
                placeholder="Digite a justificativa para o reagendamento..."
                placeholderTextColor="#999999"
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <CustomButton
              compact
              title="Continuar"
              onPress={handleContinue}
              disabled={!justification.trim()}
              variant="outline"
              textStyle={styles.continueButtonText}
              rightIcon={<MaterialSymbolIcon name="chevron_right" size={24} color="#000E3D" />}
              style={styles.continueButton}
            />
          </View>
        </View>

      {/* Success Modal */}
      <RescheduleSuccessModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.replace('/(merchant)/dashboard');
        }}
      />
    </ScreenContainer>
  );
};

export default MerchantRescheduleConfirmScreen;

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
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 1,
    gap: 16,
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
  justificationContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    height: 90,
  },
  justificationInput: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
    lineHeight: 20,
    height: 66,
  },
  buttonContainer: {
    marginTop: 8,
    paddingTop: 16,
  },
  continueButton: {
    height: undefined,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#000E3D',
    backgroundColor: 'transparent',
    marginVertical: 0,
  },
  continueButtonText: {
    color: '#000E3D',
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
});
