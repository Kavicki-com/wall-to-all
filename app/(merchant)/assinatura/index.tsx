// F7: assinatura do lojista sobre o SubscriptionService mock; Stripe Billing na Task 17 da F8.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSubscriptionService, useWalletService } from '../../../context/ServicesContext';
import { useNotifications } from '../../../context/NotificationContext';
import { HomeTopBar } from '../../../components/home/HomeTopBar';
import { AppDrawer } from '../../../components/layout/AppDrawer';
import { MERCHANT_DRAWER_ITEMS } from '../../../components/layout/merchantDrawerItems';
import NotificationModal from '../../../components/notifications/NotificationModal';
import { CardSelectionBottomSheet } from '../../../components/payment/CardSelectionBottomSheet';
import { PaymentProcessingSheet } from '../../../components/payment/PaymentProcessingSheet';
import SubscriptionOfferView from '../../../components/subscription/SubscriptionOfferView';
import SubscriptionManageView from '../../../components/subscription/SubscriptionManageView';
import { CustomButton } from '../../../components/CustomButton';
import { Icon } from '../../../components/ui/Icon';
import { useToast } from '../../../components/ui/ToastProvider';
import { logger } from '../../../lib/logger';
import { colors } from '../../../lib/theme';
import type { PaymentCard } from '../../../lib/services/types';
import type {
  Subscription,
  SubscriptionInvoice,
  SubscriptionPlan,
} from '../../../lib/services/subscriptionTypes';

// Mesma duração mínima do "Processando" da confirmação de agendamento (F5):
// evita um flash do sheet quando o serviço responde rápido.
const PROCESSING_MIN_MS = 600;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const DECLINED_MESSAGE = 'Pagamento recusado. Tente outro cartão.';
const GENERIC_ERROR = 'Não foi possível concluir. Tente novamente.';

interface SubscriptionData {
  plan: SubscriptionPlan;
  subscription: Subscription | null;
  invoices: SubscriptionInvoice[];
  cards: PaymentCard[];
}

/** Gerenciar só existe para assinatura viva; nunca assinou, recusada ou encerrada caem na Oferta. */
function isLive(subscription: Subscription | null): subscription is Subscription {
  return subscription?.status === 'active' || subscription?.status === 'past_due';
}

/**
 * Assinatura do LOJISTA (F7): rota hub que mostra a Oferta (`2678:150`) ou o
 * Gerenciar (`2680:177`) conforme o status. Casca igual à do Financeiro
 * (HomeTopBar → AppDrawer + NotificationModal). A HomeTopBar não tem título,
 * então "Minha assinatura" vai no corpo (divergência #11 do design).
 *
 * Quem cobra é o SubscriptionService: a tela só escolhe o cartão
 * (CardSelectionBottomSheet) e mostra o PaymentProcessingSheet enquanto há
 * cobrança (assinar, ou trocar cartão com fatura em aberto).
 */
const MerchantSubscriptionScreen: React.FC = () => {
  const router = useRouter();
  const subscriptionService = useSubscriptionService();
  const walletService = useWalletService();
  const { unreadCount, refreshNotifications } = useNotifications();
  const { showSuccess, showError } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sheetMode, setSheetMode] = useState<'subscribe' | 'change' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const [plan, subscription, invoices, cards] = await Promise.all([
        subscriptionService.getPlan(),
        subscriptionService.getSubscription(),
        subscriptionService.getInvoices(),
        walletService.getCards(),
      ]);
      if (!mountedRef.current) return;
      setData({ plan, subscription, invoices, cards });
      setLoadFailed(false);
    } catch (error) {
      logger.error('Erro ao carregar a assinatura:', error);
      if (!mountedRef.current) return;
      setLoadFailed(true);
      showError('Não foi possível carregar a assinatura.');
    }
    // showError é estável (ToastProvider); fora das deps para não recriar o load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionService, walletService]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Serializa as operações: um toque duplo não cobra nem cancela duas vezes. */
  const runExclusive = useCallback(
    async (operation: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await operation();
      } catch (error) {
        logger.error('Erro na operação da assinatura:', error);
        showError(GENERIC_ERROR);
      } finally {
        busyRef.current = false;
        if (mountedRef.current) {
          setBusy(false);
          setProcessing(false);
        }
        await load();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  const handleCardSelected = (card: PaymentCard) => {
    const mode = sheetMode;
    setSheetMode(null);
    const current = data?.subscription ?? null;

    if (mode === 'subscribe') {
      runExclusive(async () => {
        setProcessing(true);
        const [result] = await Promise.all([
          subscriptionService.subscribe(card),
          delay(PROCESSING_MIN_MS),
        ]);
        if (result.status === 'active') showSuccess('Assinatura ativada');
        else showError(DECLINED_MESSAGE);
      });
      return;
    }

    if (mode === 'change') {
      runExclusive(async () => {
        if (current?.status === 'past_due') {
          // Trocar o cartão cobra a fatura em aberto: mostra o processamento.
          setProcessing(true);
          const [result] = await Promise.all([
            subscriptionService.updatePaymentCard(card),
            delay(PROCESSING_MIN_MS),
          ]);
          if (result.status === 'active') showSuccess('Pagamento confirmado');
          else showError(DECLINED_MESSAGE);
          return;
        }
        await subscriptionService.updatePaymentCard(card);
        showSuccess('Cartão atualizado');
      });
    }
  };

  const handleCancel = () =>
    runExclusive(async () => {
      await subscriptionService.cancel();
      showSuccess('Cancelamento agendado');
    });

  const handleResume = () =>
    runExclusive(async () => {
      await subscriptionService.resume();
      showSuccess('Assinatura mantida');
    });

  const closeNotifications = useCallback(() => {
    setNotifModalVisible(false);
    refreshNotifications();
  }, [refreshNotifications]);

  const cards = data?.cards ?? [];
  const defaultCardId = cards.find((card) => card.isDefault)?.id ?? cards[0]?.id ?? null;
  const selectedCardId =
    sheetMode === 'change' ? (data?.subscription?.card?.id ?? defaultCardId) : defaultCardId;

  let body: React.ReactNode;
  if (data) {
    body = isLive(data.subscription) ? (
      <SubscriptionManageView
        plan={data.plan}
        subscription={data.subscription}
        invoices={data.invoices}
        onChangeCard={() => setSheetMode('change')}
        onCancel={handleCancel}
        onResume={handleResume}
        busy={busy}
      />
    ) : (
      <SubscriptionOfferView
        plan={data.plan}
        onSubscribe={() => setSheetMode('subscribe')}
        onOpenTerms={() => router.push('/(merchant)/settings/terms')}
        subscribeDisabled={busy || cards.length === 0}
        noCardHint={cards.length === 0 ? 'Nenhum cartão salvo' : undefined}
      />
    );
  } else if (loadFailed) {
    body = (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>Não foi possível carregar a assinatura.</Text>
        <CustomButton title="Tentar novamente" variant="outline" onPress={load} width="100%" />
      </View>
    );
  } else {
    body = (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.root}>
        <HomeTopBar
          onMenu={() => setDrawerOpen(true)}
          onBell={() => setNotifModalVisible(true)}
          notificationCount={unreadCount}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.back}
            hitSlop={8}
          >
            <Icon name="chevron_left" family="MaterialSymbols" size={24} color={colors.brand} />
            <Text style={styles.backText}>Voltar</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            Minha assinatura
          </Text>
          {body}
        </ScrollView>
      </View>

      <CardSelectionBottomSheet
        visible={sheetMode !== null}
        cards={cards}
        selectedCardId={selectedCardId}
        onSelect={handleCardSelected}
        onClose={() => setSheetMode(null)}
      />
      <PaymentProcessingSheet visible={processing} />
      <AppDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={MERCHANT_DRAWER_ITEMS}
      />
      <NotificationModal
        visible={notifModalVisible}
        onClose={closeNotifications}
        onNotificationsUpdated={refreshNotifications}
      />
    </>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.brand,
  },
  loading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  errorBox: {
    gap: 16,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default MerchantSubscriptionScreen;
