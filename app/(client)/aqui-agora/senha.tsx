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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueService } from '../../../context/ServicesContext';
import type { QueueTicket } from '../../../lib/services/types';
import { Icon } from '../../../components/ui/Icon';
import { Toggle } from '../../../components/ui/Toggle';
import { colors } from '../../../lib/theme';
import { useMerchant } from '../../../lib/hooks/useNearbyMerchants';
import { formatDistance } from '../../../lib/formatters';

/**
 * Merchant cuja fila é simulada "ao vivo". O domínio da fila NÃO carrega o
 * merchantId no `QueueTicket` (o snapshot do cliente), e o mock opera uma única
 * fila interna — a do merchant "ao vivo". Usamos o id para carregar
 * nome/distância (`useMerchant`) e para navegar ao perfil do lojista.
 */
const LIVE_MERCHANT_ID = 'm1';

/** Rótulo decorativo do serviço (o domínio da fila não modela serviço). */
const SERVICE_LABEL = 'Corte Masculino';

/** Endereço decorativo (o domínio ainda não expõe endereço do merchant). */
const MERCHANT_ADDRESS = 'Rua Vergueiro, 1234';

/** Segmentos da barra de progresso (decorativa) do tempo estimado. */
const SEGMENT_COUNT = 5;

type LoadStatus = 'loading' | 'ready' | 'empty';

/** Variante de cada segmento da barra: já percorrido, marcador atual, à frente. */
type SegmentVariant = 'passed' | 'lead' | 'ahead';

/** "6" → "6º". Ordinal simples em pt-BR (masculino) para a posição na fila. */
function ordinal(position: number): string {
  return `${position}º`;
}

/** Status terminal do ticket: saiu da fila (não há mais o que exibir na senha). */
function isTerminal(status: QueueTicket['status']): boolean {
  return status === 'served' || status === 'no_show' || status === 'left';
}

/**
 * Senha (cliente) da experiência "Aqui e Agora" — tela AO VIVO "Sua senha /
 * fura-fila ativado" (Figma node 2643:20265). É o destino de `fura-fila` (após o
 * pagamento) e de `waiting-list` (quando o ticket é chamado). O núcleo é o
 * realtime: no mount, `getMyTicket()` traz o snapshot inicial; em seguida
 * `subscribeToTicket(id, cb)` emite a CADA mudança da fila (não emite no
 * subscribe — o snapshot é o getMyTicket), atualizando posição/ETA ao vivo. A
 * função de unsubscribe é chamada na limpeza do efeito. Se o ticket resolve para
 * um status terminal (served/no_show/left) ou o snapshot é null, cai no estado
 * vazio — NÃO há laço de navegação (esta é a própria senha). "Sair da fila" abre
 * um modal de confirmação e, ao confirmar, chama `leaveQueue(id)` e volta ao mapa.
 */
const SenhaScreen: React.FC = () => {
  const router = useRouter();
  const queueService = useQueueService();
  const insets = useSafeAreaInsets();

  // Merchant "ao vivo" (nome/distância) — decorativo + link ao perfil.
  const { merchant } = useMerchant(LIVE_MERCHANT_ID);

  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [notify, setNotify] = useState(true);

  // Realtime: snapshot inicial via getMyTicket, depois assina as mudanças da
  // fila. A assinatura só começa APÓS o snapshot (o contrato não emite no
  // subscribe). Um update com status terminal (o merchant me atendeu / marcou
  // no-show, ou saí em outra sessão) leva ao estado vazio — sem navegação. A
  // limpeza cancela a assinatura e ignora resoluções tardias.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    queueService
      .getMyTicket()
      .then((snapshot) => {
        if (!active) return;
        if (!snapshot || isTerminal(snapshot.status)) {
          setStatus('empty');
          return;
        }
        setTicket(snapshot);
        setStatus('ready');
        unsubscribe = queueService.subscribeToTicket(snapshot.id, (updated) => {
          if (!active) return;
          if (isTerminal(updated.status)) {
            setTicket(null);
            setStatus('empty');
            return;
          }
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

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleMerchantPress = useCallback(() => {
    router.push(`/(client)/aqui-agora/merchant/${LIVE_MERCHANT_ID}`);
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

  const positionInLine = ticket?.positionInLine ?? 0;

  // Barra de progresso (5 segmentos): o marcador `lead` (brand) avança da
  // esquerda para a extremidade direita conforme a posição diminui; atrás dele
  // ficam os segmentos já percorridos (surfacePrimaryLight) e à frente os ainda
  // não alcançados (surfaceGrey). No design (posição 1) o marcador está no
  // último segmento → 4 claros + 1 brand.
  const progress = Math.min(Math.max(SEGMENT_COUNT - positionInLine + 1, 0), SEGMENT_COUNT);
  const segments = useMemo<SegmentVariant[]>(
    () =>
      Array.from({ length: SEGMENT_COUNT }, (_, index) => {
        if (index === progress - 1) return 'lead';
        return index < progress - 1 ? 'passed' : 'ahead';
      }),
    [progress],
  );

  // Legenda contextual da barra: "próximo" quando estou na frente (≤ 1), senão
  // o número de atendimentos ainda à minha frente.
  const progressCaption =
    positionInLine <= 1 ? 'Você é o próximo' : `${positionInLine - 1} atendimentos antes de você`;

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
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backButton}
            onPress={handleBack}
          >
            <Icon name="chevron-left" size={24} color={colors.contentLight} />
            <Text style={styles.backText}>Voltar</Text>
          </Pressable>

          <View style={styles.ticketCard}>
            <Text style={styles.ticketNumber}>#{ticket.number}</Text>
            <Text style={styles.ticketService}>{SERVICE_LABEL}</Text>
          </View>

          <Text accessibilityLiveRegion="polite" style={styles.positionText}>
            {ticket.positionInLine <= 0 ? (
              <Text style={styles.positionStrong}>É a sua vez!</Text>
            ) : (
              <>
                <Text style={styles.positionMuted}>Você é o </Text>
                <Text style={styles.positionStrong}>{ordinal(ticket.positionInLine)}</Text>
                <Text style={styles.positionMuted}> da fila</Text>
              </>
            )}
          </Text>
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

            <View
              style={styles.timerRow}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                ticket.positionInLine <= 0
                  ? 'É a sua vez'
                  : `${ticket.estimatedWaitMinutes} minutos restantes`
              }
            >
              {ticket.positionInLine <= 0 ? (
                <Text style={styles.timerCalled}>Chamando você</Text>
              ) : (
                <>
                  <Text style={styles.timerValue}>{ticket.estimatedWaitMinutes}</Text>
                  <View style={styles.timerUnitBlock}>
                    <Text style={styles.timerUnit}>min</Text>
                    <Text style={styles.timerUnitCaption}>restantes</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.progressRow}>
              {segments.map((variant, index) => (
                <View
                  key={index}
                  style={[
                    styles.segment,
                    variant === 'passed' && styles.segmentPassed,
                    variant === 'lead' && styles.segmentLead,
                    variant === 'ahead' && styles.segmentAhead,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.progressCaption}>{progressCaption}</Text>
          </View>

          {/* Card do merchant — nome/endereço + distância; toca para o perfil. */}
          <View style={styles.merchantSection}>
            <Text style={styles.merchantEyebrow}>Você está na fila de</Text>
            <View style={styles.merchantHeaderRow}>
              <Text style={styles.merchantName} numberOfLines={1}>
                {merchant?.name ?? 'Estabelecimento'}
              </Text>
              <Text style={styles.merchantAddress} numberOfLines={1}>
                {MERCHANT_ADDRESS}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver perfil do estabelecimento"
              style={styles.merchantContentRow}
              onPress={handleMerchantPress}
            >
              <Icon name="content-cut" size={20} color={colors.textSecondary} />
              <Text style={styles.merchantDistance}>
                {merchant ? `${formatDistance(merchant.distanceKm)} de você` : 'Perto de você'}
              </Text>
              <Icon name="chevron-right" size={24} color={colors.neutral400} />
            </Pressable>
            <View style={styles.merchantDivider} />
          </View>

          {/* Toggle de notificação (estado local, decorativo). */}
          <View style={styles.notifyRow}>
            <Icon name="notifications-none" size={22} color={colors.brand} />
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
          <Pressable accessibilityRole="button" style={styles.leaveButton} onPress={handleLeavePress}>
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
              accessibilityState={{ disabled: leaving }}
              style={styles.modalCancel}
              disabled={leaving}
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

export default SenhaScreen;

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
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
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
    fontSize: 32,
    color: colors.brand,
  },
  ticketService: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  positionText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  positionMuted: {
    color: colors.contentPrimaryLight,
  },
  positionStrong: {
    color: colors.contentLight,
  },
  body: {
    padding: 20,
    rowGap: 24,
  },
  etaCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    padding: 16,
    rowGap: 16,
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    columnGap: 6,
  },
  timerValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    color: colors.textPrimary,
  },
  timerUnitBlock: {
    alignItems: 'flex-start',
  },
  timerUnit: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.textSecondary,
  },
  timerUnitCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  timerCalled: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: colors.accent,
  },
  progressRow: {
    flexDirection: 'row',
    columnGap: 6,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 4,
  },
  segmentPassed: {
    backgroundColor: colors.surfacePrimaryLight,
  },
  segmentLead: {
    backgroundColor: colors.brand,
  },
  segmentAhead: {
    backgroundColor: colors.surfaceGrey,
  },
  progressCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  merchantSection: {
    rowGap: 12,
  },
  merchantEyebrow: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  merchantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  merchantName: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  merchantAddress: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  merchantContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  merchantDistance: {
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
  },
  merchantDivider: {
    height: 1,
    backgroundColor: colors.surfaceGrey,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    padding: 12,
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
