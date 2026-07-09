import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueueService, useWalletService } from '../../../context/ServicesContext';
import type { NearbyMerchant, PaymentCard } from '../../../lib/services/types';
import { TopBar } from '../../../components/layout/TopBar';
import { Icon } from '../../../components/ui/Icon';
import { IconCheckCircle, IconRadioFill, IconRadioNoFill } from '../../../lib/icons';
import { colors } from '../../../lib/theme';
import { formatBRL } from '../../../lib/formatters';
import { SP_CENTER } from '../../../lib/aqui-agora/constants';

type Status = 'loading' | 'ready' | 'error';
type Urgency = 'padrao' | 'furar';
type Method = 'pix' | 'card';

/**
 * Preço-base decorativo do serviço (em centavos). O domínio da fila NÃO modela
 * preço de serviço — apenas a taxa de urgência (`furaFilaPriceCents`). Este valor
 * estático alimenta a linha "Serviço" do resumo e o card "SERVIÇO SOLICITADO";
 * o total real soma esta base à taxa da urgência selecionada.
 */
const SERVICE_BASE_CENTS = 8000; // R$ 80,00

/** Endereço decorativo (o domínio ainda não expõe endereço do merchant). */
const MERCHANT_ADDRESS = 'Av. Paulista, 1000 - Bela Vista - São Paulo';

/**
 * Seleção fura-fila (cliente) da experiência "Aqui e Agora" — tela "Confirmar
 * serviço" (Figma node 2513:538). Recebe o `merchantId` encaminhado pelo perfil
 * do lojista (Task 15), carrega os merchants próximos via `QueueService`
 * (`useQueueService`, nunca instanciado aqui) e localiza o merchant pelo id para
 * ler nome + `queue.settings.furaFilaPriceCents` (a taxa de urgência).
 *
 * A urgência tem duas opções radio: "Padrão" (taxa 0) e "Furar fila" (taxa =
 * furaFilaPriceCents, default selecionada, pois esta é a tela do fura-fila). O
 * resumo reflete a urgência escolhida no total.
 *
 * "Confirmar e Pagar" executa o pagamento mock do total via `WalletService`
 * (Pix por `createPixCharge` ou cartão por `payWithCard`), depois entra na fila
 * com `joinQueue(merchantId, { furaFila })` e abre o modal de sucesso (node
 * 2659:6381). NB: os bottom-sheets reutilizáveis de pagamento são da Task 17 —
 * aqui o pagamento é inline e autossuficiente, com um seletor Pix|cartão simples.
 */
const FuraFilaScreen: React.FC = () => {
  const router = useRouter();
  const queueService = useQueueService();
  const walletService = useWalletService();
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>();

  const [merchant, setMerchant] = useState<NearbyMerchant | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [urgency, setUrgency] = useState<Urgency>('furar');
  const [method, setMethod] = useState<Method>('pix');
  const [choosingMethod, setChoosingMethod] = useState(false);
  const [defaultCard, setDefaultCard] = useState<PaymentCard | null>(null);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    queueService
      .getNearbyMerchants(SP_CENTER)
      .then((result) => {
        if (!active) return;
        const found = result.find((m) => m.id === merchantId) ?? null;
        setMerchant(found);
        setStatus(found ? 'ready' : 'error');
      })
      .catch(() => {
        if (!active) return;
        setMerchant(null);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [queueService, merchantId]);

  useEffect(() => {
    let active = true;
    walletService
      .getCards()
      .then((cards) => {
        if (!active) return;
        setDefaultCard(cards.find((card) => card.isDefault) ?? cards[0] ?? null);
      })
      .catch(() => {
        // Falha ao listar cartões não bloqueia a tela: o Pix segue disponível.
      });
    return () => {
      active = false;
    };
  }, [walletService]);

  const feeCents = urgency === 'furar' ? (merchant?.queue.settings.furaFilaPriceCents ?? 0) : 0;
  const totalCents = SERVICE_BASE_CENTS + feeCents;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSelectMethod = useCallback((next: Method) => {
    setMethod(next);
    setChoosingMethod(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (paying || !merchant) return;
    setPaying(true);
    const description = `Fura-fila · ${merchant.name}`;
    try {
      if (method === 'card' && defaultCard) {
        await walletService.payWithCard(defaultCard.id, totalCents, description);
      } else {
        await walletService.createPixCharge(totalCents, description);
      }
      await queueService.joinQueue(merchant.id, { furaFila: urgency === 'furar' });
      setSuccess(true);
    } catch {
      // Reabilita o CTA para nova tentativa se o pagamento/entrada na fila falhar.
      setPaying(false);
    }
  }, [paying, merchant, method, defaultCard, totalCents, urgency, walletService, queueService]);

  const handleCloseSuccess = useCallback(() => {
    router.push('/(client)/aqui-agora/senha');
  }, [router]);

  const methodTitle = useMemo(() => {
    if (method === 'card' && defaultCard) return `Cartão •••• ${defaultCard.last4}`;
    return 'Pagamento via Pix';
  }, [method, defaultCard]);

  const methodSubtitle = useMemo(() => {
    if (method === 'card' && defaultCard) return defaultCard.holderName;
    return 'Chave: ••••.1234';
  }, [method, defaultCard]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <TopBar variant="light" title="Confirmar serviço" onBack={handleBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  if (status === 'error' || !merchant) {
    return (
      <View style={styles.container}>
        <TopBar variant="light" title="Confirmar serviço" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Não foi possível carregar este estabelecimento.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar variant="light" title="Confirmar serviço" onBack={handleBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho do lojista: avatar (placeholder) + nome + endereço (decorativo). */}
        <View style={styles.merchantHeader}>
          <View style={styles.avatar}>
            <Icon name="storefront" size={22} color={colors.contentLight} />
          </View>
          <Text style={styles.merchantName}>{merchant.name}</Text>
        </View>
        <View style={styles.addressCard}>
          <Text style={styles.addressText}>{MERCHANT_ADDRESS}</Text>
        </View>

        {/* SERVIÇO SOLICITADO — rótulo/duração decorativos + preço-base do serviço. */}
        <View style={styles.serviceCard}>
          <Text style={styles.serviceLabel}>SERVIÇO SOLICITADO</Text>
          <View style={styles.serviceRow}>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>Serviço solicitado</Text>
              <Text style={styles.serviceDuration}>Aprox. 90 minutos</Text>
            </View>
            <View style={styles.serviceValueBlock}>
              <Text style={styles.serviceValue}>{formatBRL(SERVICE_BASE_CENTS)}</Text>
              <Text style={styles.serviceValueCaption}>Valor a pagar</Text>
            </View>
          </View>
        </View>

        {/* Urgência — Furar a Fila: descrição + duas opções radio. */}
        <Text style={styles.sectionTitle}>Urgência - Furar a Fila</Text>
        <Text style={styles.sectionDescription}>
          Pague uma taxa extra para ser atendido antes dos demais clientes na fila.
        </Text>

        <UrgencyOption
          selected={urgency === 'padrao'}
          title="Padrão"
          subtitle="Fila normal, sem taxa adicional"
          etaLabel="~45min"
          etaWarning={false}
          onPress={() => setUrgency('padrao')}
        />
        <UrgencyOption
          selected={urgency === 'furar'}
          title="Furar fila"
          subtitle="Próximo a ser atendido"
          etaLabel="~5min"
          etaWarning
          badge={`+${formatBRL(merchant.queue.settings.furaFilaPriceCents)}`}
          onPress={() => setUrgency('furar')}
        />

        {/* Resumo: serviço + taxa de urgência (reflete a seleção) → total. */}
        <Text style={styles.sectionTitle}>Resumo</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Serviço</Text>
            <Text style={styles.summaryValue}>{formatBRL(SERVICE_BASE_CENTS)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de urgência</Text>
            <Text style={styles.summaryValue}>{formatBRL(feeCents)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text testID="summary-total" style={styles.summaryTotal}>
              {formatBRL(totalCents)}
            </Text>
          </View>
        </View>

        {/* Método de pagamento (inline; bottom-sheets reutilizáveis são da Task 17). */}
        <View style={styles.paymentRow}>
          <View style={styles.paymentIcon}>
            <Icon name={method === 'card' ? 'credit-card' : 'pix'} size={24} color={colors.brand} />
          </View>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>{methodTitle}</Text>
            <Text style={styles.paymentSubtitle}>{methodSubtitle}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.changeButton}
            onPress={() => setChoosingMethod((prev) => !prev)}
          >
            <Text style={styles.changeButtonText}>Alterar</Text>
            <Icon name="chevron-right" size={22} color={colors.brand} />
          </Pressable>
        </View>

        {choosingMethod && (
          <View style={styles.methodChooser}>
            <Pressable
              accessibilityRole="button"
              style={styles.methodChooserOption}
              onPress={() => handleSelectMethod('pix')}
            >
              {method === 'pix' ? (
                <IconRadioFill size={20} color={colors.brand} />
              ) : (
                <IconRadioNoFill size={20} color={colors.surfaceGrey} />
              )}
              <Text style={styles.methodChooserLabel}>Pagamento via Pix</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.methodChooserOption}
              onPress={() => handleSelectMethod('card')}
              disabled={!defaultCard}
            >
              {method === 'card' ? (
                <IconRadioFill size={20} color={colors.brand} />
              ) : (
                <IconRadioNoFill size={20} color={colors.surfaceGrey} />
              )}
              <Text style={styles.methodChooserLabel}>
                {defaultCard ? `Cartão •••• ${defaultCard.last4}` : 'Cartão indisponível'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* CTA primário: pagamento mock + entrada na fila + modal de sucesso. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: paying }}
          style={[styles.confirmButton, paying && styles.confirmButtonDisabled]}
          disabled={paying}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmButtonText}>Confirmar e Pagar</Text>
        </Pressable>
      </ScrollView>

      {/* Modal de sucesso (Figma node 2659:6381). */}
      <Modal visible={success} transparent animationType="fade" onRequestClose={handleCloseSuccess}>
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <View style={styles.modalCard}>
            <IconCheckCircle size={40} color={colors.surfaceSuccess} />
            <Text style={styles.modalTitle}>Pagamento Realizado</Text>
            <Text style={styles.modalMessage}>Você será o próximo da fila!</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.modalButton}
              onPress={handleCloseSuccess}
            >
              <Text style={styles.modalButtonText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default FuraFilaScreen;

interface UrgencyOptionProps {
  selected: boolean;
  title: string;
  subtitle: string;
  etaLabel: string;
  etaWarning: boolean;
  badge?: string;
  onPress: () => void;
}

/** Cartão de opção radio da urgência. Selecionado → borda 2px de aviso + radio cheio. */
const UrgencyOption: React.FC<UrgencyOptionProps> = ({
  selected,
  title,
  subtitle,
  etaLabel,
  etaWarning,
  badge,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={[styles.urgencyOption, selected && styles.urgencyOptionSelected]}
    onPress={onPress}
  >
    {selected ? (
      <IconRadioFill size={20} color={colors.contentWarning} />
    ) : (
      <IconRadioNoFill size={20} color={colors.surfaceGrey} />
    )}
    <View style={styles.urgencyInfo}>
      <View style={styles.urgencyTitleRow}>
        <Text style={styles.urgencyTitle}>{title}</Text>
        {badge ? (
          <View style={styles.urgencyBadge}>
            <Text style={styles.urgencyBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.urgencySubtitle}>{subtitle}</Text>
    </View>
    <View style={styles.etaBlock}>
      <Text style={[styles.etaLabel, etaWarning && styles.etaLabelWarning]}>{etaLabel}</Text>
      <Text style={styles.etaCaption}>espera</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    rowGap: 16,
    paddingBottom: 32,
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantName: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  addressCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  addressText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  serviceCard: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    borderRadius: 16,
    padding: 16,
    rowGap: 8,
  },
  serviceLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceInfo: {
    flex: 1,
    rowGap: 4,
  },
  serviceName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  serviceDuration: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  serviceValueBlock: {
    alignItems: 'flex-end',
  },
  serviceValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.brand,
  },
  serviceValueCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  sectionDescription: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -8,
  },
  urgencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: colors.contentLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    padding: 16,
  },
  urgencyOptionSelected: {
    borderWidth: 2,
    borderColor: colors.contentWarning,
  },
  urgencyInfo: {
    flex: 1,
    rowGap: 4,
  },
  urgencyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  urgencyTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  urgencyBadge: {
    backgroundColor: colors.surfaceWarningLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  urgencyBadgeText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentWarning,
  },
  urgencySubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  etaBlock: {
    alignItems: 'flex-end',
  },
  etaLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textSecondary,
  },
  etaLabelWarning: {
    color: colors.contentWarning,
  },
  etaCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: colors.contentLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    padding: 16,
    rowGap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.surfaceGrey,
  },
  summaryTotal: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: colors.surfacePrimaryExtraLight,
    borderRadius: 4,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 12,
  },
  paymentIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.textPrimary,
  },
  paymentSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  changeButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  methodChooser: {
    backgroundColor: colors.contentLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    padding: 16,
    rowGap: 16,
    marginTop: -8,
  },
  methodChooserOption: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  methodChooserLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
  },
  confirmButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  confirmButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    padding: 40,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    rowGap: 16,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.surfaceSuccess,
    textAlign: 'center',
  },
  modalMessage: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});
