import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import AppointmentSuccessModal from '../../../components/AppointmentSuccessModal';
import { useToast } from '../../../components/ui/ToastProvider';
import { handleError } from '../../../lib/errorHandler';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { BookingConfirmCard } from '../../../components/booking/BookingConfirmCard';
import { PaymentPixBottomSheet } from '../../../components/payment/PaymentPixBottomSheet';
import { PaymentProcessingSheet } from '../../../components/payment/PaymentProcessingSheet';
import { CardSelectionBottomSheet } from '../../../components/payment/CardSelectionBottomSheet';
import { safeGoBack } from '../../../lib/router-utils';
import { BookingError, createAppointment } from '../../../lib/booking/createAppointment';
import { priceToCents } from '../../../lib/booking/money';
import { useBookingPaymentService, useWalletService } from '../../../context/ServicesContext';
import { logger } from '../../../lib/logger';
import { Service as FullService, BusinessProfile } from '../../../lib/types';
import type { PaymentCard } from '../../../lib/services/types';
import type { BookingPaymentInput, BookingPaymentMethod } from '../../../lib/services/bookingTypes';
import { colors } from '../../../lib/theme';

type Service = Pick<FullService, 'id' | 'name' | 'price' | 'description' | 'duration_minutes'>;

type Business = Pick<BusinessProfile, 'id' | 'business_name' | 'address' | 'logo_url'>;

/** Tempo mínimo do "Processando seu pagamento..." no cartão (evita um flash). */
const PROCESSING_MIN_MS = 600;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Pagamento sem os campos que a tela completa na hora de registrar. */
type PaymentOutcome = Omit<BookingPaymentInput, 'amountCents'>;

const NO_CARD = { cardLast4: null, cardBrand: null } as const;

const ScheduleConfirmScreen: React.FC = () => {
  const router = useRouter();
  const wallet = useWalletService();
  const booking = useBookingPaymentService();
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
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>('pix');
  const [observations, setObservations] = useState('');
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pixSheetVisible, setPixSheetVisible] = useState(false);
  const [cardSheetVisible, setCardSheetVisible] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadData é estável (useCallback), não precisa estar nas dependências
  }, [params.businessId, params.serviceId]);

  // Recarrega os cartões a cada foco (ex.: volta do cadastro de cartão) e
  // mantém a seleção se o cartão ainda existir; senão cai no default.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      wallet
        .getCards()
        .then((list) => {
          if (!active) return;
          setCards(list);
          setSelectedCardId((prev) =>
            prev && list.some((card) => card.id === prev)
              ? prev
              : ((list.find((card) => card.isDefault) ?? list[0])?.id ?? null),
          );
        })
        .catch((error) => logger.warn('Erro ao carregar cartões:', error));
      return () => {
        active = false;
      };
    }, [wallet]),
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

  const priceCents = service ? priceToCents(service.price) : 0;
  const description = service ? `Agendamento · ${service.name}` : 'Agendamento';
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );
  const payNowDisabled =
    submitting || paymentMethod === 'cash' || (paymentMethod === 'card' && !selectedCard);

  /**
   * Grava o agendamento (Supabase) e registra o resultado do pagamento (mock).
   * Chamado DEPOIS da cobrança aprovada, ou direto no "Pagar na hora".
   */
  const finalizeBooking = async (outcome: PaymentOutcome): Promise<void> => {
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
      const created = await createAppointment({
        businessId: businessIdNum,
        serviceId: serviceIdNum,
        serviceName: service.name,
        durationMinutes: service.duration_minutes,
        date: params.date,
        time: params.time,
        paymentMethod: outcome.method,
        observations,
      });

      try {
        await booking.recordPayment(created.id, { ...outcome, amountCents: priceCents });
      } catch (recordError) {
        // O agendamento já existe; sem registro o detalhe cai no payment_method.
        logger.warn('Erro ao registrar pagamento do agendamento:', recordError);
      }

      setSubmitting(false);
      setProcessing(false);
      // Pequeno atraso para o sheet fechar antes do modal abrir (dois Modals).
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
      setProcessing(false);
    }
  };

  const payWithCard = async () => {
    if (!selectedCard) return;
    setSubmitting(true);
    setProcessing(true);
    try {
      const [result] = await Promise.all([
        wallet.payWithCard(selectedCard.id, priceCents, description),
        delay(PROCESSING_MIN_MS),
      ]);
      if (result.status !== 'approved') {
        setProcessing(false);
        setSubmitting(false);
        showError('Pagamento recusado. Tente outro cartão.');
        return;
      }
    } catch (error) {
      setProcessing(false);
      setSubmitting(false);
      const processed = handleError(error, 'appointment');
      showError(processed.userMessage);
      return;
    }
    await finalizeBooking({
      status: 'paid',
      method: 'card',
      cardLast4: selectedCard.last4,
      cardBrand: selectedCard.brand,
    });
  };

  const handlePayNow = () => {
    if (payNowDisabled) return;
    if (paymentMethod === 'pix') {
      setPixSheetVisible(true);
      return;
    }
    void payWithCard();
  };

  const handlePixPaid = () => {
    setPixSheetVisible(false);
    void finalizeBooking({ status: 'paid', method: 'pix', ...NO_CARD });
  };

  const handlePayOnSite = () => {
    if (submitting) return;
    void finalizeBooking({ status: 'pay_on_site', method: paymentMethod, ...NO_CARD });
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
      header={<AppHeader showBackButton={true} onPressBack={() => safeGoBack('/(client)/home')} />}
    >
      {service && business && (
        <BookingConfirmCard
          serviceName={service.name}
          priceCents={priceCents}
          dateTimeLabel={formatDateAndTime()}
          businessName={business.business_name}
          address={business.address || undefined}
          logoUrl={business.logo_url || undefined}
          method={paymentMethod}
          onChangeMethod={setPaymentMethod}
          selectedCard={selectedCard}
          onChangeCard={() => setCardSheetVisible(true)}
          onAddCard={() => router.push('/(client)/wallet/new-card')}
          observations={observations}
          onChangeObservations={setObservations}
          onPayNow={handlePayNow}
          onPayOnSite={handlePayOnSite}
          submitting={submitting}
          payNowDisabled={payNowDisabled}
        />
      )}

      <PaymentPixBottomSheet
        visible={pixSheetVisible}
        amountCents={priceCents}
        description={description}
        onSuccess={handlePixPaid}
        onClose={() => setPixSheetVisible(false)}
      />

      <CardSelectionBottomSheet
        visible={cardSheetVisible}
        cards={cards}
        selectedCardId={selectedCardId}
        onSelect={(card) => {
          setSelectedCardId(card.id);
          setCardSheetVisible(false);
        }}
        onClose={() => setCardSheetVisible(false)}
      />

      <PaymentProcessingSheet visible={processing} />

      <AppointmentSuccessModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.replace('/(client)/appointments');
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
