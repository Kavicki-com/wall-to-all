import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  type DimensionValue,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueService } from '../../../context/ServicesContext';
import type { QueueSettings, QueueStatus, QueueTicket } from '../../../lib/services/types';
import { Icon } from '../../../components/ui/Icon';
import { IconMenu } from '../../../lib/icons';
import { Toggle } from '../../../components/ui/Toggle';
import { AppDrawer, DrawerItem } from '../../../components/layout/AppDrawer';
import { RequestBottomSheet } from '../../../components/aqui-agora/RequestBottomSheet';
import { colors } from '../../../lib/theme';
import { LIVE_MERCHANT_ID } from '../../../lib/services/mock/queueFixtures';

/**
 * Rotas de gestão da fila (Task 21) e de configuração (Task 22) do Aqui e Agora.
 * Ainda são alvos "dangling" nesta task — serão criadas nas próximas —, exatamente
 * como a senha foi um alvo pendente enquanto a lista de espera já apontava para ela.
 */
const FILA_ROUTE = '/(merchant)/aqui-agora/fila';
const SETTINGS_ROUTE = '/(merchant)/aqui-agora/settings';

/**
 * Duração DECORATIVA do "Ativo há … min" do active-alert. O domínio da fila não
 * modela o instante de ativação; manter um valor estático evita depender de
 * Date.now()/new Date() (que tornaria o snapshot de teste não determinístico e o
 * texto "vivo" sem uma fonte de verdade real).
 */
const ACTIVE_MINUTES = 2;

/** Cartões de métrica DECORATIVOS (o domínio ainda não expõe analytics do lojista). */
const STATS: ReadonlyArray<{ icon: string; label: string; value: string }> = [
  { icon: 'date-range', label: 'Visualizações', value: '47' },
  { icon: 'handshake', label: 'Solicitações', value: '8' },
  { icon: 'trending-up', label: 'Conversão', value: '34%' },
];

/**
 * Lista DECORATIVA de "clientes próximos" (o domínio não modela clientes por
 * proximidade). Cada linha encaminha para a gestão da fila (Task 21).
 */
const NEARBY_CLIENTS: ReadonlyArray<{
  name: string;
  distance: string;
  time: string;
  service: string;
}> = [
  { name: 'Maria Oliveira', distance: '120 m', time: '5 minutos', service: 'Barba e Cabelo' },
  { name: 'Ana Costa', distance: '250 m', time: '12 minutos', service: 'Corte Máquina' },
  { name: 'Juliana Santos', distance: '550 m', time: '23 minutos', service: 'Corte Masculino' },
];

/** Pinos DECORATIVOS do mini-mapa (posições em % da área do mapa). */
const MAP_PINS: ReadonlyArray<{
  label: string;
  color: string;
  left: DimensionValue;
  top: DimensionValue;
}> = [
  { label: 'M', color: colors.contentWarning, left: '22%', top: '25%' },
  { label: 'A', color: colors.surfaceSuccess, left: '62%', top: '40%' },
  { label: 'J', color: colors.accent, left: '34%', top: '72%' },
];

/** OFFLINE quando inativa/pausada; ONLINE quando ativa/cheia. */
function isOnline(status: QueueStatus | null): boolean {
  return status === 'active' || status === 'full';
}

/**
 * Home do lojista da experiência "Aqui e Agora" — UMA rota, DOIS estados
 * (offline/inativa vs online/ativa) guiados pelo status da fila (Figma nodes
 * 2495:254 offline e 2715:3616 online). No mount, `getQueueInfo(LIVE_MERCHANT_ID)`
 * traz o status/settings do próprio lojista; o toggle "Ativar o Aqui e Agora"
 * alterna via `setQueueStatus('active'|'paused')` (otimista + guarda em voo). A
 * seção "Próximos da fila" liga-se à fila do lojista: snapshot em
 * `getMerchantQueue()` + `subscribeToMerchantQueue(cb)` ao vivo (unsubscribe na
 * limpeza). O mini-mapa, as métricas e os "clientes próximos" são decorativos.
 */
const MerchantAquiAgoraScreen: React.FC = () => {
  const router = useRouter();
  const queueService = useQueueService();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Solicitação recebida: o ticket que abre o RequestBottomSheet (Task 23), ou
  // null quando não há sheet aberto.
  const [incomingRequest, setIncomingRequest] = useState<QueueTicket | null>(null);
  // Ids de tickets já "vistos" pela home. Populado com o snapshot inicial (as
  // fixtures pré-existentes NÃO devem abrir o sheet); só chegadas posteriores
  // (ids inéditos, status 'waiting') contam como novas solicitações.
  const seenTicketIds = useRef<Set<string>>(new Set());

  // Status/settings do próprio lojista (fila do LIVE_MERCHANT_ID).
  useEffect(() => {
    let active = true;
    queueService
      .getQueueInfo(LIVE_MERCHANT_ID)
      .then((info) => {
        if (!active) return;
        setStatus(info.status);
        setSettings(info.settings);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [queueService]);

  // Fila do lojista: snapshot inicial + assinatura ao vivo. A assinatura NÃO
  // emite no subscribe — o snapshot vem do getMerchantQueue. A limpeza cancela a
  // assinatura e ignora resoluções tardias.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    queueService
      .getMerchantQueue()
      .then((snapshot) => {
        if (!active) return;
        setTickets(snapshot);
        setQueueLoaded(true);
        // Marca TODOS os tickets do snapshot inicial como vistos — as fixtures
        // pré-existentes não disparam o sheet de solicitação.
        for (const ticket of snapshot) {
          seenTicketIds.current.add(ticket.id);
        }
        unsubscribe = queueService.subscribeToMerchantQueue((updated) => {
          if (!active) return;
          setTickets(updated);
          // Detecta uma NOVA solicitação: um ticket 'waiting' cujo id ainda não
          // vimos (uma chegada via joinQueue). Detecta ANTES de marcar como visto.
          const arrival = updated.find(
            (ticket) => ticket.status === 'waiting' && !seenTicketIds.current.has(ticket.id),
          );
          // Marca todos os ids atuais como vistos (inclui o recém-chegado) para
          // não reabrir o sheet em emissões subsequentes.
          for (const ticket of updated) {
            seenTicketIds.current.add(ticket.id);
          }
          if (arrival) {
            // Update funcional: se um sheet já está aberto, NÃO o substitui — uma
            // segunda solicitação nova enquanto o sheet está aberto é descartada
            // (tratamos uma solicitação por vez nesta fase).
            // TODO(F2): fila de solicitações pendentes p/ surfacear a próxima ao dispensar.
            setIncomingRequest((prev) => prev ?? arrival);
          }
        });
      })
      .catch(() => {
        // Falha ao carregar a fila: destrava a seção (cai no estado vazio).
        if (active) setQueueLoaded(true);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [queueService]);

  const online = isOnline(status);

  // Resumo da fila derivado dos tickets ao vivo (mesma conta do QueueInfo do
  // mock): aguardando = waiting; atendendo = número do ticket 'called'; espera
  // média = aguardando × avgServiceMinutes.
  const waitingCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'waiting').length,
    [tickets],
  );
  const nowServingNumber = useMemo(
    () => tickets.find((ticket) => ticket.status === 'called')?.number ?? null,
    [tickets],
  );
  const estimatedWaitMinutes = waitingCount * (settings?.avgServiceMinutes ?? 0);
  const queueEmpty = tickets.length === 0;

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (toggling) return;
      const target: QueueStatus = next ? 'active' : 'paused';
      const previous = status;
      setToggling(true);
      setStatus(target); // otimista
      try {
        await queueService.setQueueStatus(target);
      } catch {
        setStatus(previous); // reverte se a operação falhar
      } finally {
        setToggling(false);
      }
    },
    [toggling, status, queueService],
  );

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleEditRadius = useCallback(() => {
    router.push(SETTINGS_ROUTE);
  }, [router]);

  const handleClientPress = useCallback(() => {
    router.push(FILA_ROUTE);
  }, [router]);

  // Aceitar a solicitação = o cliente PERMANECE na fila (o lojista o atende pela
  // tela de gestão de fila). Nenhuma mutação de domínio — apenas fecha o sheet.
  const handleAcceptRequest = useCallback(() => {
    setIncomingRequest(null);
  }, []);

  // Recusar/dispensar = remove o cliente da fila. O domínio não tem desfecho
  // 'rejected'; 'no_show' via resolveTicket (lado lojista) é o mais próximo.
  // Ignora falhas (o mock não falha) e fecha o sheet.
  const handleRejectRequest = useCallback(() => {
    if (incomingRequest) {
      queueService.resolveTicket(incomingRequest.id, 'no_show').catch(() => undefined);
    }
    setIncomingRequest(null);
  }, [incomingRequest, queueService]);

  // Itens do menu (drawer) do lojista — rotas já existentes do app.
  const drawerItems: DrawerItem[] = useMemo(
    () => [
      { label: 'Início', route: '/(merchant)/home' },
      { label: 'Agenda', route: '/(merchant)/dashboard' },
      { label: 'Serviços', route: '/(merchant)/services' },
      { label: 'Financeiro', route: '/(merchant)/financeiro' },
      { label: 'Perfil', route: '/(merchant)/profile' },
      { label: 'Configurações', route: '/(merchant)/settings' },
    ],
    [],
  );

  return (
    <View style={styles.container}>
      {/* Top bar navy — apenas o hambúrguer, abre o AppDrawer. */}
      <View style={styles.topBar}>
        <View style={[styles.topBarInset, { height: insets.top }]} />
        <View style={styles.topBarContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir menu"
            testID="topbar-menu"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={openDrawer}
          >
            <IconMenu size={24} color={colors.contentLight} />
          </Pressable>
        </View>
      </View>

      {!loaded ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* active-alert — só online. */}
          {online ? (
            <View style={styles.activeAlert} accessible accessibilityLiveRegion="polite">
              <Text style={styles.activeAlertTitle}>
                Aparecendo no mapa para clientes próximos
              </Text>
              <View style={styles.timerRow}>
                <Text style={styles.timerLabel}>Ativo há</Text>
                <Text style={styles.timerValue}>{ACTIVE_MINUTES} min</Text>
                <Text style={styles.timerCaption}>• encerra automaticamente em 2h</Text>
              </View>
            </View>
          ) : null}

          {/* Grupo de ativação: status + mini-mapa + toggle. */}
          <View style={styles.activationGroup}>
            <View style={styles.statusRow}>
              <View
                style={[styles.statusDot, online ? styles.statusDotOnline : styles.statusDotOffline]}
              />
              <Text style={online ? styles.statusTextOnline : styles.statusTextOffline}>
                {online ? 'Você está online' : 'Você está offline'}
              </Text>
            </View>

            {/* map-card — mini-mapa DECORATIVO (não usa react-native-maps). */}
            <View style={[styles.mapCard, !online && styles.mapCardDimmed]}>
              <View style={[styles.mapArea, online ? styles.mapAreaOnline : styles.mapAreaOffline]}>
                <View style={styles.mapCircleOuter} />
                <View style={styles.mapCircleInner} />
                {online
                  ? MAP_PINS.map((pin) => (
                      <View
                        key={pin.label}
                        style={[
                          styles.mapPin,
                          { backgroundColor: pin.color, left: pin.left, top: pin.top },
                        ]}
                      >
                        <Text style={styles.mapPinText}>{pin.label}</Text>
                      </View>
                    ))
                  : null}
              </View>
              <View style={styles.mapInfo}>
                <View style={styles.radInfo}>
                  <Text style={styles.radLabel}>Raio de visibilidade</Text>
                  <Text style={styles.radValue}>3 km • Centro</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Editar raio de visibilidade"
                  testID="btn-edit-radius"
                  style={styles.editButton}
                  onPress={handleEditRadius}
                >
                  <Text style={styles.editButtonText}>Editar</Text>
                </Pressable>
              </View>
            </View>

            {/* active-row: "Ativar o Aqui e Agora" + toggle. */}
            <View style={styles.activeRow}>
              <Text style={styles.activeRowLabel}>Ativar o Aqui e Agora</Text>
              <Toggle
                value={online}
                onValueChange={handleToggle}
                disabled={toggling}
                accessibilityLabel="Ativar o Aqui e Agora"
                testID="activation-toggle"
              />
            </View>
          </View>

          {/* stats-row — 3 métricas DECORATIVAS. */}
          <View style={styles.statsRow}>
            {STATS.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Icon name={stat.icon} size={20} color={colors.brand} />
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {/* Próximos da fila — resumo ao vivo ou mensagem vazia. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Próximos da fila</Text>
            {/* Gate na própria carga da fila (não em `loaded`, que é o status):
                evita um flash da mensagem vazia antes do snapshot chegar. */}
            {!queueLoaded ? null : queueEmpty ? (
              <Text style={styles.emptyQueueText}>
                Você ainda não tem nenhum cliente na fila, aguarde uma solicitação para visualizar
              </Text>
            ) : (
              <View
                style={styles.queueSummary}
                testID="queue-summary"
                accessible
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${waitingCount} aguardando, atendendo ${
                  nowServingNumber != null ? `senha ${nowServingNumber}` : 'ninguém'
                }, espera média ${estimatedWaitMinutes} minutos`}
              >
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue} testID="queue-waiting-count">
                    {waitingCount}
                  </Text>
                  <Text style={styles.summaryLabel}>Aguardando</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {nowServingNumber != null ? `#${nowServingNumber}` : '—'}
                  </Text>
                  <Text style={styles.summaryLabel}>Atendendo</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{estimatedWaitMinutes} min</Text>
                  <Text style={styles.summaryLabel}>Espera média</Text>
                </View>
              </View>
            )}
          </View>

          {/* Clientes próximos — lista DECORATIVA; cada linha vai para a fila (Task 21). */}
          <View style={styles.section}>
            <View style={styles.clientsHeader}>
              <Text style={styles.sectionTitle}>Clientes próximos</Text>
              <View style={styles.clientsBadge}>
                <Text style={styles.clientsBadgeText}>{NEARBY_CLIENTS.length}</Text>
              </View>
            </View>
            <View style={styles.clientsList}>
              {NEARBY_CLIENTS.map((client, index) => (
                <Pressable
                  key={client.name}
                  accessibilityRole="button"
                  accessibilityLabel={`${client.name}, ${client.service}, a ${client.distance}`}
                  testID={`nearby-client-row-${index}`}
                  style={styles.clientRow}
                  onPress={handleClientPress}
                >
                  <View style={styles.clientHeader}>
                    <Text style={styles.clientDistance}>{client.distance}</Text>
                    <Text style={styles.clientTime}>{client.time}</Text>
                  </View>
                  <View style={styles.clientContent}>
                    <Icon name="content-cut" size={24} color={colors.brand} />
                    <Text style={styles.clientService}>{client.service}</Text>
                    <Icon name="chevron-right" size={22} color={colors.neutral400} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <AppDrawer visible={drawerOpen} onClose={closeDrawer} items={drawerItems} />

      {/* Sheet de solicitação recebida — invisível até uma NOVA solicitação
          chegar pela assinatura da fila. Aceitar mantém o cliente na fila;
          recusar o remove (no_show). */}
      <RequestBottomSheet
        visible={incomingRequest !== null}
        ticket={incomingRequest}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
      />
    </View>
  );
};

export default MerchantAquiAgoraScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // ── Top bar navy ─────────────────────────────────────────
  topBar: {
    backgroundColor: colors.brand,
  },
  topBarInset: {
    backgroundColor: colors.surfacePrimaryExtraLight, // faixa clara sobre a status bar
  },
  topBarContent: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    rowGap: 24,
  },
  // ── active-alert ─────────────────────────────────────────
  activeAlert: {
    backgroundColor: colors.surfaceInfoLight,
    borderRadius: 16,
    padding: 16,
    rowGap: 16,
    alignItems: 'center',
  },
  activeAlertTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  timerLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  timerValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentInfo,
  },
  timerCaption: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textPrimary,
  },
  // ── grupo de ativação ────────────────────────────────────
  activationGroup: {
    rowGap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotOnline: {
    backgroundColor: colors.surfaceSuccess,
  },
  statusDotOffline: {
    backgroundColor: colors.neutral400,
  },
  statusTextOnline: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.surfaceSuccess,
  },
  statusTextOffline: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  // ── map-card ─────────────────────────────────────────────
  mapCard: {
    backgroundColor: colors.contentLight,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapCardDimmed: {
    opacity: 0.5,
  },
  mapArea: {
    width: '100%',
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapAreaOnline: {
    height: 220,
  },
  mapAreaOffline: {
    height: 104,
  },
  mapCircleOuter: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,55,235,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,55,235,0.12)',
  },
  mapCircleInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,55,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,55,235,0.18)',
  },
  mapPin: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.contentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  mapInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.contentLight,
    padding: 12,
  },
  radInfo: {
    rowGap: 4,
    flexShrink: 1,
  },
  radLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  radValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  // ── active-row ───────────────────────────────────────────
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  activeRowLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  // ── stats-row ────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.contentLight,
    borderRadius: 4,
    padding: 8,
    rowGap: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  // ── seções ───────────────────────────────────────────────
  section: {
    rowGap: 16,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  emptyQueueText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  // ── resumo da fila (estado não-vazio) ────────────────────
  queueSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.contentLight,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    padding: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    rowGap: 4,
  },
  summaryValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceGrey,
  },
  // ── clientes próximos ────────────────────────────────────
  clientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  clientsBadge: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  clientsBadgeText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.contentLight,
  },
  clientsList: {
    rowGap: 8,
  },
  clientRow: {
    rowGap: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.textPrimary,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
  },
  clientDistance: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: colors.neutral400,
  },
  clientTime: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textPrimary,
  },
  clientContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
    height: 40,
  },
  clientService: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
});
