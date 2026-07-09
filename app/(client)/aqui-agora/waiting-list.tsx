import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueService } from '../../../context/ServicesContext';
import type { QueueTicket } from '../../../lib/services/types';
import { Icon } from '../../../components/ui/Icon';
import { FuraFilaIcon } from '../../../components/icons/FuraFilaIcon';
import { Toggle } from '../../../components/ui/Toggle';
import { colors } from '../../../lib/theme';
import { formatBRL } from '../../../lib/formatters';
import { useMerchant } from '../../../lib/hooks/useNearbyMerchants';

/**
 * Merchant cuja fila é simulada "ao vivo". O domínio da fila NÃO carrega o
 * merchantId no `QueueTicket` (o snapshot do cliente), e o mock opera uma única
 * fila interna — a do merchant "ao vivo". Portanto a lista de espera pertence a
 * esse merchant: usamos o id para carregar nome/endereço/taxa de fura-fila
 * (`useMerchant`) e para encaminhar o merchantId ao upsell de fura-fila.
 */
const LIVE_MERCHANT_ID = 'm1';

/** Rótulo decorativo do serviço (o domínio da fila não modela serviço). */
const SERVICE_LABEL = 'Corte Masculino';

/** Endereço decorativo (o domínio ainda não expõe endereço do merchant). */
const MERCHANT_ADDRESS = 'Av. Paulista, 1000 - Bela Vista';

/** Segmentos da barra de progresso (decorativa): mais preenchidos = mais perto. */
const PROGRESS_SEGMENTS = 8;

type LoadStatus = 'loading' | 'ready' | 'empty';

/** "6" → "6º". Ordinal simples em pt-BR (masculino) para a posição na fila. */
function ordinal(position: number): string {
  return `${position}º`;
}

/**
 * Lista de espera (cliente) da experiência "Aqui e Agora" — tela AO VIVO (Figma
 * node 2496:313). O núcleo é o realtime: no mount, `getMyTicket()` traz o
 * snapshot inicial do meu ticket; em seguida `subscribeToTicket(id, cb)` emite a
 * CADA mudança da fila (não emite no subscribe — o snapshot é o getMyTicket),
 * atualizando posição/ETA ao vivo. A função de unsubscribe é chamada na limpeza
 * do efeito. Quando o ticket vira `status === 'called'`, navega uma única vez
 * para a senha. "Sair da fila" abre um modal de confirmação e, ao confirmar,
 * chama `leaveQueue(id)` e volta ao mapa.
 */
const WaitingListScreen: React.FC = () => {
  const router = useRouter();
  const queueService = useQueueService();
  const insets = useSafeAreaInsets();

  // Merchant "ao vivo" (nome/endereço/taxa de fura-fila) — decorativo + upsell.
  const { merchant } = useMerchant(LIVE_MERCHANT_ID);

  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [notify, setNotify] = useState(true);

  // Garante que a navegação para a senha (ao ser chamado) dispare uma só vez.
  const navigatedRef = useRef(false);

  // Realtime: snapshot inicial via getMyTicket, depois assina as mudanças da
  // fila. A assinatura só começa APÓS o snapshot (o contrato não emite no
  // subscribe). A limpeza cancela a assinatura e ignora resoluções tardias.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    queueService
      .getMyTicket()
      .then((snapshot) => {
        if (!active) return;
        if (!snapshot) {
          setStatus('empty');
          return;
        }
        setTicket(snapshot);
        setStatus('ready');
        unsubscribe = queueService.subscribeToTicket(snapshot.id, (updated) => {
          if (!active) return;
          setTicket(updated);
        });
      })
      .catch(() => {
        if (active) setStatus('empty');
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [queueService]);

  // Quando o ticket é chamado, navega para a senha (uma única vez).
  useEffect(() => {
    if (ticket?.status === 'called' && !navigatedRef.current) {
      navigatedRef.current = true;
      router.replace('/(client)/aqui-agora/senha');
    }
  }, [ticket?.status, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleFuraFila = useCallback(() => {
    router.push({
      pathname: '/(client)/aqui-agora/fura-fila',
      params: { merchantId: LIVE_MERCHANT_ID },
    });
  }, [router]);

  const handleLeavePress = useCallback(() => {
    setConfirmVisible(true);
  }, []);

  const handleCancelLeave = useCallback(() => {
    setConfirmVisible(false);
  }, []);

  const handleConfirmLeave = useCallback(async () => {
    if (!ticket || leaving) return;
    setLeaving(true);
    try {
      await queueService.leaveQueue(ticket.id);
      setConfirmVisible(false);
      router.replace('/(client)/aqui-agora');
    } catch {
      // Reabilita a confirmação para nova tentativa se a saída falhar.
      setLeaving(false);
    }
  }, [ticket, leaving, queueService, router]);

  const aheadCount = ticket ? Math.max(ticket.positionInLine - 1, 0) : 0;
  const filledSegments = ticket
    ? Math.min(Math.max(PROGRESS_SEGMENTS - ticket.positionInLine, 0), PROGRESS_SEGMENTS)
    : 0;
  const segments = useMemo(
    () => Array.from({ length: PROGRESS_SEGMENTS }, (_, index) => index < filledSegments),
    [filledSegments],
  );

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <View style={[styles.heroLoading, { paddingTop: insets.top + 16 }]}>
          <ActivityIndicator color={colors.contentLight} />
        </View>
      </View>
    );
  }

  if (status === 'empty' || !ticket) {
    return (
      <View style={styles.container}>
        <View style={[styles.heroLoading, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.emptyText}>Você não está em nenhuma fila.</Text>
          <Pressable accessibilityRole="button" style={styles.emptyButton} onPress={handleBack}>
            <Text style={styles.emptyButtonText}>Voltar ao mapa</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket-hero (navy, cantos inferiores arredondados). */}
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backButton}
            onPress={handleBack}
          >
            <Icon name="arrow-back" size={22} color={colors.contentLight} />
            <Text style={styles.backText}>Voltar</Text>
          </Pressable>

          <View style={styles.ticketCard}>
            <Text style={styles.ticketNumber}>#{ticket.number}</Text>
            <Text style={styles.ticketService}>{SERVICE_LABEL}</Text>
          </View>

          <Text style={styles.positionText}>Você é o {ordinal(ticket.positionInLine)} da fila</Text>
        </View>

        <View style={styles.body}>
          {/* Card de tempo estimado — ao vivo. */}
          <View style={styles.etaCard}>
            <View style={styles.etaHeader}>
              <Text style={styles.sectionTitle}>Tempo estimado</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Ao vivo</Text>
              </View>
            </View>

            <View style={styles.timerRow}>
              <Text style={styles.timerValue}>{ticket.estimatedWaitMinutes}</Text>
              <Text style={styles.timerUnit}>min restantes</Text>
            </View>

            <View style={styles.progressRow}>
              {segments.map((filled, index) => (
                <View
                  key={index}
                  style={[styles.segment, filled ? styles.segmentFilled : styles.segmentEmpty]}
                />
              ))}
            </View>

            <Text style={styles.aheadText}>{aheadCount} atendimentos antes de você</Text>
          </View>

          {/* Upsell de fura-fila — só quando o ticket ainda não é fura-fila. */}
          {!ticket.isFuraFila && merchant ? (
            <Pressable accessibilityRole="button" style={styles.furaCard} onPress={handleFuraFila}>
              <View style={styles.furaIconWrap}>
                <FuraFilaIcon width={20} height={20} color={colors.contentLight} />
              </View>
              <View style={styles.furaInfo}>
                <Text style={styles.furaTitle}>
                  Fure a fila por {formatBRL(merchant.queue.settings.furaFilaPriceCents)}
                </Text>
                <Text style={styles.furaSubtitle}>Próximo a ser atendido</Text>
              </View>
              <Icon name="chevron-right" size={24} color={colors.contentWarning} />
            </Pressable>
          ) : null}

          {/* Card do merchant. */}
          <View style={styles.merchantCard}>
            <Text style={styles.merchantEyebrow}>Você está na fila de</Text>
            <Text style={styles.merchantName}>{merchant?.name ?? 'Estabelecimento'}</Text>
            <View style={styles.merchantMetaRow}>
              <Icon name="location-on" size={16} color={colors.textSecondary} />
              <Text style={styles.merchantMeta}>{MERCHANT_ADDRESS}</Text>
            </View>
          </View>

          {/* Toggle de notificação (estado local, decorativo). */}
          <View style={styles.notifyRow}>
            <View style={styles.notifyInfo}>
              <Text style={styles.notifyTitle}>Avisar quando estiver próximo</Text>
              <Text style={styles.notifySubtitle}>15 min antes da sua vez</Text>
            </View>
            <Toggle
              value={notify}
              onValueChange={setNotify}
              accessibilityLabel="Avisar quando estiver próximo"
            />
          </View>

          {/* Sair da fila → modal de confirmação. */}
          <Pressable
            accessibilityRole="button"
            style={styles.leaveButton}
            onPress={handleLeavePress}
          >
            <Text style={styles.leaveButtonText}>Sair da fila</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal de confirmação de saída. */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelLeave}
      >
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <View style={styles.modalCard}>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              Deseja sair da fila?
            </Text>
            <Text style={styles.modalMessage}>
              Você perderá sua posição atual e precisará entrar novamente.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: leaving }}
              style={[styles.modalConfirm, leaving && styles.modalConfirmDisabled]}
              disabled={leaving}
              onPress={handleConfirmLeave}
            >
              <Text style={styles.modalConfirmText}>Sim, sair</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.modalCancel}
              onPress={handleCancelLeave}
            >
              <Text style={styles.modalCancelText}>Continuar na fila</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default WaitingListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroLoading: {
    backgroundColor: colors.brand,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    rowGap: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  emptyText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    color: colors.contentLight,
    textAlign: 'center',
  },
  emptyButton: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: colors.contentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: colors.brand,
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    rowGap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.contentLight,
  },
  ticketCard: {
    backgroundColor: colors.contentLight,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    rowGap: 4,
  },
  ticketNumber: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 40,
    color: colors.brand,
  },
  ticketService: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  positionText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.contentPrimaryLight,
    textAlign: 'center',
  },
  body: {
    padding: 20,
    rowGap: 16,
  },
  etaCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.contentLightGrey,
    padding: 16,
    rowGap: 12,
  },
  etaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: colors.surfaceGrey,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  liveText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 8,
  },
  timerValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 36,
    color: colors.textPrimary,
  },
  timerUnit: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: colors.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    columnGap: 4,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  segmentFilled: {
    backgroundColor: colors.surfacePrimaryLight,
  },
  segmentEmpty: {
    backgroundColor: colors.surfaceGrey,
  },
  aheadText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
  },
  furaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: colors.surfaceWarningLight,
    borderRadius: 16,
    padding: 16,
  },
  furaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.contentWarning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  furaInfo: {
    flex: 1,
    rowGap: 2,
  },
  furaTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  furaSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  merchantCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.contentLightGrey,
    padding: 16,
    rowGap: 4,
  },
  merchantEyebrow: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  merchantName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  merchantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    marginTop: 4,
  },
  merchantMeta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.contentLightGrey,
    padding: 16,
  },
  notifyInfo: {
    flex: 1,
    rowGap: 2,
  },
  notifyTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  notifySubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  leaveButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  leaveButtonText: {
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
    rowGap: 12,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalMessage: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalConfirm: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalConfirmDisabled: {
    backgroundColor: colors.disabled,
  },
  modalConfirmText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  modalCancel: {
    paddingVertical: 8,
  },
  modalCancelText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
  },
});
