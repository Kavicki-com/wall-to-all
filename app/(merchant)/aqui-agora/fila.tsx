import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueService } from '../../../context/ServicesContext';
import type { QueueSettings, QueueTicket } from '../../../lib/services/types';
import { Icon } from '../../../components/ui/Icon';
import { Chip } from '../../../components/ui/Chip';
import { FuraFilaIcon } from '../../../components/icons/FuraFilaIcon';
import { colors } from '../../../lib/theme';

/**
 * Rótulo DECORATIVO do serviço no serving-card (o domínio da fila não modela
 * serviço). Espelha a linha "Corte de cabelo masculino" do Figma.
 */
const SERVICE_LABEL = 'Corte de cabelo masculino';

/** Filtro local da lista de espera. */
type WaitingFilter = 'all' | 'fura';

/**
 * Iniciais DECORATIVAS para o avatar da linha (o domínio não expõe foto/avatar).
 * "Bruno Lima" → "BL"; "Você" → "V". NÃO buscamos imagens remotas.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Linha de um ticket "waiting" na lista "Próximos da fila". Cartão branco com
 * borda; badge "#{number}" (fura-fila em warning, regular em info/brand), avatar
 * DECORATIVO de iniciais, nome e bloco de ETA à direita. Tickets fura-fila
 * carregam a etiqueta "Furou fila" (warning + FuraFilaIcon) sobre o cartão.
 */
const WaitingRow: React.FC<{ ticket: QueueTicket }> = ({ ticket }) => {
  const fura = ticket.isFuraFila;
  return (
    <View
      style={[styles.row, fura && styles.rowFura]}
      accessible
      accessibilityLabel={`Senha ${ticket.number}, ${ticket.customerName}${
        fura ? ', furou a fila' : ''
      }, ${ticket.estimatedWaitMinutes} minutos estimados`}
    >
      {fura ? (
        <View style={styles.furaTab}>
          <Text style={styles.furaTabText}>Furou fila</Text>
          <FuraFilaIcon width={14} height={14} color={colors.contentWarning} />
        </View>
      ) : null}
      <View style={styles.rowContent}>
        <View style={[styles.badge, fura ? styles.badgeFura : styles.badgeRegular]}>
          <Text style={[styles.badgeText, fura ? styles.badgeTextFura : styles.badgeTextRegular]}>
            #{ticket.number}
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(ticket.customerName)}</Text>
        </View>
        <Text style={styles.rowName} numberOfLines={1}>
          {ticket.customerName}
        </Text>
        <View style={styles.eta}>
          <Text style={styles.etaValue}>{ticket.estimatedWaitMinutes} min</Text>
          <Text style={styles.etaCaption}>estimado</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Gestão de Fila (lojista) da experiência "Aqui e Agora" — UMA rota, DOIS estados
 * guiados pela própria fila (Figma nodes 2590:5155 vazia e 2596:5847 populada). O
 * núcleo é o realtime: no mount, `getMerchantQueue()` traz o snapshot inicial e
 * `subscribeToMerchantQueue(cb)` emite a CADA mudança (não emite no subscribe);
 * a função de unsubscribe é chamada na limpeza do efeito (guarda `active` ignora
 * resoluções tardias). Deriva dos tickets: o "ATENDENDO AGORA" é o ticket
 * `called`; a lista "Próximos da fila" são os `waiting` ordenados por posição
 * (fura-fila via joinQueue entra na posição 1; a fixture pode tê-lo mais atrás — a
 * ordem é sempre por posição). "Chamar próximo" chama `callNext()` (desabilitado sem
 * waiting E enquanto alguém está sendo atendido). No serving-card, "Atendido"/"Não
 * compareceu" chamam `resolveTicket(id, 'served'|'no_show')`. Os chips filtram a
 * lista localmente (todos os waiting vs só fura-fila).
 */
const MerchantFilaScreen: React.FC = () => {
  const router = useRouter();
  const queueService = useQueueService();
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [filter, setFilter] = useState<WaitingFilter>('all');

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
        unsubscribe = queueService.subscribeToMerchantQueue((updated) => {
          if (!active) return;
          setTickets(updated);
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

  // Settings do lojista — usado no cartão "Tempo médio" (min por atendimento).
  useEffect(() => {
    let active = true;
    queueService
      .getSettings()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch(() => {
        // Silencioso: o cartão "Tempo médio" cai no fallback 0min.
      });
    return () => {
      active = false;
    };
  }, [queueService]);

  // Derivados dos tickets ao vivo. serving = o ticket 'called' (ATENDENDO
  // AGORA); waiting = os 'waiting' ordenados por posição (fura-fila via joinQueue
  // entra na posição 1; a fixture pode tê-lo mais atrás — ordem sempre por posição).
  const serving = useMemo(
    () => tickets.find((ticket) => ticket.status === 'called') ?? null,
    [tickets],
  );
  const waiting = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.status === 'waiting')
        .sort((a, b) => a.positionInLine - b.positionInLine),
    [tickets],
  );
  const filteredWaiting = useMemo(
    () => (filter === 'fura' ? waiting.filter((ticket) => ticket.isFuraFila) : waiting),
    [waiting, filter],
  );

  const noWaiting = waiting.length === 0;
  const attendingCount = serving ? 1 : 0;
  // "Tempo médio": placeholder enquanto settings não chegou (mostrar "0min" leria
  // como um atendimento instantâneo/quebrado).
  const avgServiceLabel = settings ? `${settings.avgServiceMinutes}min` : '—';
  // "Chamar próximo" desabilita sem waiting E enquanto há um 'called' não resolvido:
  // callNext() encerra o atual como 'served' ao avançar, então forçamos resolver
  // (Atendido/Não compareceu) antes — evita marcar um no-show como atendido por engano.
  const callNextDisabled = noWaiting || serving !== null;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCallNext = useCallback(() => {
    if (callNextDisabled) return;
    // A assinatura ao vivo aplica a mudança; ignoramos falhas (mock não falha).
    queueService.callNext().catch(() => undefined);
  }, [callNextDisabled, queueService]);

  const handleServed = useCallback(() => {
    if (!serving) return;
    queueService.resolveTicket(serving.id, 'served').catch(() => undefined);
  }, [serving, queueService]);

  const handleNoShow = useCallback(() => {
    if (!serving) return;
    queueService.resolveTicket(serving.id, 'no_show').catch(() => undefined);
  }, [serving, queueService]);

  return (
    <View style={styles.container}>
      {/* Header navy (cantos inferiores arredondados): back-nav + 3 hstat cards.
          Omitimos a top bar menu+bell do Figma por ser uma sub-tela navegável
          (coerência com a senha). */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            testID="btn-back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={handleBack}
          >
            <Icon name="chevron-left" size={24} color={colors.contentLight} />
          </Pressable>
          <Text style={styles.headerTitle}>Gestão de Fila</Text>
          {/* Espaçador para centralizar o título (balanceia a chevron). */}
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Na fila</Text>
            <Text style={styles.statValue} testID="stat-na-fila">
              {waiting.length}
            </Text>
            <Text style={styles.statCaption}>aguardando</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Atendendo</Text>
            <Text style={styles.statValue}>{attendingCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tempo médio</Text>
            <Text style={styles.statValue}>{avgServiceLabel}</Text>
            <Text style={styles.statCaption}>por atendimento</Text>
          </View>
        </View>
      </View>

      {/* Corpo: gate na própria carga da fila (evita flash da mensagem vazia
          antes do snapshot chegar — espelha a home do lojista). */}
      {!queueLoaded ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ATENDENDO AGORA — serving-card + ações de resolução. Só quando há
              um ticket 'called'. */}
          {serving ? (
            <View style={styles.servingSection}>
              <View style={styles.servingHdr}>
                <View style={styles.servingDot} />
                <Text style={styles.servingHdrText}>ATENDENDO AGORA</Text>
              </View>

              <View
                style={styles.servingCard}
                accessible
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Atendendo agora, senha ${serving.number}, ${serving.customerName}`}
              >
                <View style={styles.servingTicket}>
                  <Text style={styles.servingNumber}>#{serving.number}</Text>
                  <Text style={styles.servingSenha}>senha</Text>
                </View>
                <View style={styles.servingInfo}>
                  <Text style={styles.servingName} numberOfLines={1}>
                    {serving.customerName}
                  </Text>
                  <Text style={styles.servingService} numberOfLines={1}>
                    {SERVICE_LABEL}
                  </Text>
                  <Text style={styles.servingWaiting}>Aguardando o cliente</Text>
                </View>
              </View>

              {/* Ações de resolução (além do frame estático do Figma; requisito
                  do plano — resolveTicket served/no_show). */}
              <View style={styles.resolveRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Marcar cliente como atendido"
                  testID="btn-resolve-served"
                  style={styles.resolveServed}
                  onPress={handleServed}
                >
                  <Icon name="check" size={18} color={colors.contentLight} />
                  <Text style={styles.resolveServedText}>Atendido</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Marcar cliente como não compareceu"
                  testID="btn-resolve-no-show"
                  style={styles.resolveNoShow}
                  onPress={handleNoShow}
                >
                  <Icon name="close" size={18} color={colors.textSecondary} />
                  <Text style={styles.resolveNoShowText}>Não compareceu</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Chips de filtro da lista de espera. */}
          <View style={styles.chipsRow} testID="filter-chips">
            <Chip label="Aguardando" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Furou fila" selected={filter === 'fura'} onPress={() => setFilter('fura')} />
          </View>

          <Text style={styles.sectionTitle}>Próximos da fila</Text>

          {noWaiting ? (
            <Text style={styles.emptyText}>
              Você ainda não tem nenhum cliente na fila, aguarde uma solicitação para visualizar
            </Text>
          ) : filteredWaiting.length === 0 ? (
            // Só ocorre no filtro "Furou fila" (o filtro "Aguardando" == waiting, que
            // é não-vazio quando !noWaiting). Evita uma área em branco silenciosa.
            <Text style={styles.emptyText} accessibilityLiveRegion="polite">
              Nenhum cliente furou a fila no momento
            </Text>
          ) : (
            <View style={styles.list}>
              {filteredWaiting.map((ticket) => (
                <WaitingRow key={ticket.id} ticket={ticket} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Footer fixo: "Chamar próximo" (desabilitado sem waiting). */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chamar próximo da fila"
          accessibilityState={{ disabled: callNextDisabled }}
          testID="btn-call-next"
          disabled={callNextDisabled}
          style={[styles.callButton, callNextDisabled && styles.callButtonDisabled]}
          onPress={handleCallNext}
        >
          <Text style={styles.callButtonText}>Chamar próximo</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default MerchantFilaScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Header navy ──────────────────────────────────────────
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    rowGap: 20,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  headerSpacer: {
    width: 24,
  },
  statRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  statCard: {
    flex: 1,
    // Cartão translúcido sobre a navy (o Figma mostra cartões navy mais claros,
    // não brancos — texto claro exige fundo escuro).
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    rowGap: 4,
  },
  statLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentPrimaryLight,
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: colors.contentLight,
  },
  statCaption: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: colors.contentPrimaryLight,
  },
  // ── Corpo ────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    rowGap: 16,
  },
  // ── ATENDENDO AGORA ──────────────────────────────────────
  servingSection: {
    rowGap: 12,
  },
  servingHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  servingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSuccess,
  },
  servingHdrText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.accent,
  },
  servingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
    backgroundColor: colors.surfaceSuccessLight,
    borderRadius: 16,
    padding: 16,
  },
  servingTicket: {
    alignItems: 'center',
  },
  servingNumber: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.surfaceSuccess,
  },
  servingSenha: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  servingInfo: {
    flex: 1,
    rowGap: 2,
  },
  servingName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  servingService: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  servingWaiting: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.surfaceSuccess,
  },
  // ── Ações de resolução ───────────────────────────────────
  resolveRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  resolveServed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    height: 44,
    borderRadius: 24,
    backgroundColor: colors.surfaceSuccess,
  },
  resolveServedText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
  resolveNoShow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    backgroundColor: colors.surface,
  },
  resolveNoShowText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  // ── Chips + seção ────────────────────────────────────────
  chipsRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  // ── Lista de espera ──────────────────────────────────────
  list: {
    rowGap: 16,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    padding: 12,
  },
  rowFura: {
    // Espaço para a etiqueta "Furou fila" que se projeta acima do cartão.
    marginTop: 8,
  },
  furaTab: {
    position: 'absolute',
    top: -10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    backgroundColor: colors.surfaceWarningLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1,
  },
  furaTabText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: colors.contentWarning,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  badge: {
    minWidth: 52,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeFura: {
    backgroundColor: colors.surfaceWarningLight,
  },
  badgeRegular: {
    backgroundColor: colors.surfacePrimaryLight,
  },
  badgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
  },
  badgeTextFura: {
    color: colors.contentWarning,
  },
  badgeTextRegular: {
    color: colors.brand,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
  },
  rowName: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  eta: {
    alignItems: 'flex-end',
  },
  etaValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  etaCaption: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 8,
    color: colors.textSecondary,
  },
  // ── Footer ───────────────────────────────────────────────
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  callButton: {
    height: 52,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonDisabled: {
    opacity: 0.5,
  },
  callButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
});
