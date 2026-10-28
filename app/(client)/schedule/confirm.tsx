import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import AppointmentSuccessModal from '../../../components/AppointmentSuccessModal';
import { useToast } from '../../../components/ui/ToastProvider';
import { handleError } from '../../../lib/errorHandler';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import ScheduleConfirmCard from '../../../components/ui/ScheduleConfirmCard';
import { safeGoBack } from '../../../lib/router-utils';
import { BookingError, createAppointment } from '../../../lib/booking/createAppointment';
import { Service as FullService, BusinessProfile } from '../../../lib/types';
import { colors } from '../../../lib/theme';

type Service = Pick<FullService, 'id' | 'name' | 'price' | 'description' | 'duration_minutes'>;

type Business = Pick<BusinessProfile, 'id' | 'business_name' | 'address' | 'logo_url'>;

const ScheduleConfirmScreen: React.FC = () => {
  const router = useRouter();
  const { showError, showWarning } = useToast();
  const params = useLocalSearchParams<{
    businessId: string;
    serviceId: string;
    date: string;
    time: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash'>('pix');
  const [observations, setObservations] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadData é estável (useCallback), não precisa estar nas dependências
  }, [params.businessId, params.serviceId]);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  // Não resetar o modal de sucesso aqui, pois ele deve ser controlado apenas pela confirmação e pelo onClose
  useFocusEffect(
    React.useCallback(() => {
      // Resetar campos do formulário
      setPaymentMethod('pix');
      setObservations('');
      // Forçar recriação do ScheduleConfirmCard para resetar estados internos
      setCardKey((prev) => prev + 1);
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar serviço
      if (params.serviceId) {
        const serviceIdNum = parseInt(params.serviceId, 10);
        if (!isNaN(serviceIdNum)) {
          const { data: serviceData } = await supabase
            .from('services')
            .select('id, name, price, description, duration_minutes')
            .eq('id', serviceIdNum)
            .single();

          if (serviceData) {
            setService(serviceData as Service);
          }
        }
      }

      // Buscar loja
      if (params.businessId) {
        const businessIdNum = parseInt(params.businessId, 10);
        if (!isNaN(businessIdNum)) {
          const { data: businessData } = await supabase
            .from('business_profiles')
            .select('id, business_name, address, logo_url')
            .eq('id', businessIdNum)
            .single();

          if (businessData) {
            setBusiness(businessData as Business);
          }
        }
      }
    } catch (error) {
      const processed = handleError(error, 'appointment');
      showError(processed.userMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDateAndTime = () => {
    if (!params.date || !params.time) return 'Hoje - 10h às 11h';

    // params.date é date-only (yyyy-MM-dd); parsear como data LOCAL para não
    // recuar um dia por causa da interpretação UTC de `new Date("yyyy-MM-dd")`.
    const [year, month, day] = params.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    const isToday = compareDate.getTime() === today.getTime();
    const [hours] = params.time.split(':');
    const nextHour = parseInt(hours) + 1;

    if (isToday) {
      return `Hoje - ${hours}h às ${nextHour}h`;
    }
    return `${hours}h às ${nextHour}h`;
  };

  const handleConfirm = async () => {
    if (!params.businessId || !params.serviceId || !params.date || !params.time || !service) {
      showError('Dados incompletos');
      return;
    }
    const businessIdNum = parseInt(params.businessId, 10);
    if (isNaN(businessIdNum)) {
      showError('ID do negócio inválido');
      return;
    }
    const serviceIdNum = parseInt(params.serviceId, 10);
    if (isNaN(serviceIdNum)) {
      showError('ID do serviço inválido');
      return;
    }

    try {
      setSubmitting(true);
      await createAppointment({
        businessId: businessIdNum,
        serviceId: serviceIdNum,
        serviceName: service.name,
        durationMinutes: service.duration_minutes,
        date: params.date,
        time: params.time,
        paymentMethod,
        observations,
      });

      // Exibir modal de sucesso após um pequeno delay para garantir que o estado seja atualizado
      setSubmitting(false);
      // Usar setTimeout para garantir que o modal seja exibido após o estado ser atualizado
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 100);
    } catch (error) {
      if (error instanceof BookingError) {
        // Falhas de validação viram aviso; autenticação e gravação, erro.
        if (error.code === 'unauthenticated' || error.code === 'insert_failed') {
          showError(error.message);
        } else {
          showWarning(error.message);
        }
      } else {
        const processed = handleError(error, 'appointment');
        showError(processed.userMessage);
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer style={{ backgroundColor: colors.background }} hasTabBar={true}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scroll={true}
      hasHeader={true}
      hasTabBar={true}
      backgroundColor={colors.background}
      horizontalPadding={0}
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
    >
      {service && business && (
        <ScheduleConfirmCard
          key={cardKey}
          serviceName={service.name}
          price={service.price}
          dateTime={formatDateAndTime()}
          businessName={business.business_name}
          address={business.address || undefined}
          logoUrl={business.logo_url || undefined}
          isLoading={submitting}
          paymentMethod={paymentMethod}
          onChangePaymentMethod={setPaymentMethod}
          observations={observations}
          onChangeObservations={setObservations}
          onConfirm={handleConfirm}
          showConfirmButton={true}
        />
      )}

      {/* Success Modal */}
      <AppointmentSuccessModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          // Redirecionar para a home do cliente após confirmar agendamento
          router.replace('/(client)/home');
        }}
      />
    </ScreenContainer>
  );
};

export default ScheduleConfirmScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 0,
    paddingTop: 0,
    paddingBottom: 64,
  },
});

