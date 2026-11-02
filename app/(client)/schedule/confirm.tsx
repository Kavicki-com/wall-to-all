import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  BookingError,
  createAppointment,
  notifyAppointmentCreated,
} from '../../../lib/booking/createAppointment';
import type { AppointmentDraft, CreatedAppointment } from '../../../lib/booking/createAppointment';
import { priceToCents } from '../../../lib/booking/money';
import { useBookingPaymentService, useWalletService } from '../../../context/ServicesContext';
import { logger } from '../../../lib/logger';
import { Service as FullService, BusinessProfile } from '../../../lib/types';
import type { PaymentCard, PaymentRequestContext } from '../../../lib/services/types';
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

/** Agendamento reservado (criado `pending`, sem notificar) aguardando pagamento. */
interface Reservation {
  draft: AppointmentDraft;
  created: CreatedAppointment;
}

/** Uma cobrança por agendamento: a mesma chave em toda nova tentativa. */
const bookingContext = (appointmentId: number): PaymentRequestContext => ({
  purpose: { kind: 'booking', appointmentId },
  idempotencyKey: `booking:${appointmentId}`,
});

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
  // F8: reserva viva e se ela já foi paga. Ref (não state): os callbacks e o
  // efeito de saída leem o valor atual; o sheet Pix lê ao abrir (re-render).
  const reservationRef = useRef<Reservation | null>(null);
  const paidRef = useRef(false);
  const bookingRef = useRef(booking);
  bookingRef.current = booking;

  // Saiu da tela com a reserva não paga (voltou após a recusa): libera o
  // horário e cancela a cobrança pendente.
  useEffect(() => {
    return () => {
      const reservation = reservationRef.current;
      if (!reservation || paidRef.current) return;
      bookingRef.current
        .cancelUnpaid(reservation.created.id)
        .catch((error) => logger.warn('Erro ao liberar a reserva não paga:', error));
    };
  }, []);

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

  /** Rascunho do agendamento a partir dos params; null (com toast) se incompleto. */
  const buildDraft = (method: BookingPaymentMethod): AppointmentDraft | null => {
    if (!params.businessId || !params.serviceId || !params.date || !params.time || !service) {
      showError('Dados incompletos');
      return null;
    }
    const businessIdNum = parseInt(params.businessId, 10);
    if (isNaN(businessIdNum)) {
      showError('ID do negócio inválido');
      return null;
    }
    const serviceIdNum = parseInt(params.serviceId, 10);
    if (isNaN(serviceIdNum)) {
      showError('ID do serviço inválido');
      return null;
    }
    return {
      businessId: businessIdNum,
      serviceId: serviceIdNum,
      serviceName: service.name,
      durationMinutes: service.duration_minutes,
      date: params.date,
      time: params.time,
      paymentMethod: method,
      observations,
    };
  };

  const showBookingError = (error: unknown) => {
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
  };

  const openSuccessModal = () => {
    setSubmitting(false);
    setProcessing(false);
    // Pequeno atraso para o sheet fechar antes do modal abrir (dois Modals).
    setTimeout(() => {
      setShowSuccessModal(true);
    }, 100);
  };

  /**
   * F8 (design § 7): reserva o horário ANTES de cobrar, sem notificar. Falhou,
   * nada foi cobrado. Uma reserva por tela: novas tentativas reaproveitam.
   */
  const reserve = async (method: BookingPaymentMethod): Promise<Reservation | null> => {
    if (reservationRef.current) return reservationRef.current;
    const draft = buildDraft(method);
    if (!draft) return null;
    try {
      const created = await createAppointment(draft, { notify: false });
      const reservation = { draft, created };
      reservationRef.current = reservation;
      return reservation;
    } catch (error) {
      showBookingError(error);
      return null;
    }
  };

  /** Desistência antes de pagar: cancela a cobrança e libera o horário. */
  const releaseReservation = async (): Promise<void> => {
    const reservation = reservationRef.current;
    if (!reservation || paidRef.current) return;
    reservationRef.current = null;
    try {
      await booking.cancelUnpaid(reservation.created.id);
    } catch (error) {
      // O servidor também libera reservas abandonadas depois do prazo.
      logger.warn('Erro ao liberar a reserva não paga:', error);
    }
  };

  /** Pagamento aprovado: confere o registro, notifica (mock) e abre o modal. */
  const completeBooking = async (
    reservation: Reservation,
    outcome: PaymentOutcome,
  ): Promise<void> => {
    try {
      await booking.recordPayment(reservation.created.id, { ...outcome, amountCents: priceCents });
    } catch (recordError) {
      logger.warn('Pagamento do agendamento não confirmado:', recordError);
      setSubmitting(false);
      setProcessing(false);
      showError('Ainda não identificamos o pagamento. Tente de novo em instantes.');
      return;
    }
    paidRef.current = true;
    if (!booking.serverNotifiesOnPayment) {
      // Sem webhook (mock): o aviso ao lojista sai daqui, já com o pagamento ok.
      void notifyAppointmentCreated(reservation.draft, reservation.created);
    }
    openSuccessModal();
  };

  const payWithCard = async () => {
    if (!selectedCard) return;
    setSubmitting(true);
    setProcessing(true);
    const reservation = await reserve('card');
    if (!reservation) {
      setProcessing(false);
      setSubmitting(false);
      return;
    }
    try {
      const [result] = await Promise.all([
        wallet.payWithCard(
          selectedCard.id,
          priceCents,
          description,
          bookingContext(reservation.created.id),
        ),
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
    await completeBooking(reservation, {
      status: 'paid',
      method: 'card',
      cardLast4: selectedCard.last4,
      cardBrand: selectedCard.brand,
    });
  };

  const openPix = async () => {
    setSubmitting(true);
    const reservation = await reserve('pix');
    setSubmitting(false);
    if (reservation) setPixSheetVisible(true);
  };

  const handlePayNow = () => {
    if (payNowDisabled) return;
    if (paymentMethod === 'pix') {
      void openPix();
      return;
    }
    void payWithCard();
  };

  const handlePixPaid = () => {
    setPixSheetVisible(false);
    const reservation = reservationRef.current;
    if (!reservation) return;
    void completeBooking(reservation, { status: 'paid', method: 'pix', ...NO_CARD });
  };

  const handlePixClose = () => {
    setPixSheetVisible(false);
    void releaseReservation();
  };

  /** "Pagar na hora": sem cobrança online; cria o agendamento já notificando. */
  const handlePayOnSite = async () => {
    if (submitting) return;
    const method = paymentMethod;
    const draft = buildDraft(method);
    if (!draft) return;
    setSubmitting(true);
    // Reserva de uma tentativa online anterior: libera antes de criar de novo.
    await releaseReservation();
    try {
      const created = await createAppointment(draft);
      paidRef.current = true;
      try {
        await booking.recordPayment(created.id, {
          status: 'pay_on_site',
          method,
          amountCents: priceCents,
          ...NO_CARD,
        });
      } catch (recordError) {
        // O agendamento já existe; sem registro o detalhe cai no payment_method.
        logger.warn('Erro ao registrar pagamento do agendamento:', recordError);
      }
      openSuccessModal();
    } catch (error) {
      showBookingError(error);
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
          onPayOnSite={() => void handlePayOnSite()}
          submitting={submitting}
          payNowDisabled={payNowDisabled}
        />
      )}

      <PaymentPixBottomSheet
        visible={pixSheetVisible}
        amountCents={priceCents}
        description={description}
        context={
          pixSheetVisible && reservationRef.current
            ? bookingContext(reservationRef.current.created.id)
            : undefined
        }
        onSuccess={handlePixPaid}
        onClose={handlePixClose}
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
