import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { logger } from '../../../lib/logger';
import { colors } from '../../../lib/theme';
import { getInitials } from '../../../lib/formatters';
import {
  computeMonthOverview,
  groupRevenueByService,
  computeDelta,
} from '../../../lib/dashboardMetrics';
import type {
  MonthOverview,
  RevenueSegment,
  ServiceRevenueRow,
} from '../../../lib/dashboardMetrics';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import HomeTopBar from '../../../components/home/HomeTopBar';
import { AppDrawer, DrawerItem } from '../../../components/layout/AppDrawer';
import NotificationModal from '../../../components/notifications/NotificationModal';
import { useNotifications } from '../../../context/NotificationContext';
import { GoalOverview } from '../../../components/dashboard/GoalOverview';
import { KpiCard } from '../../../components/dashboard/KpiCard';
import { RevenueDonut } from '../../../components/dashboard/RevenueDonut';
import { Icon } from '../../../components/ui/Icon';
import { useToast } from '../../../components/ui/ToastProvider';
import { Business } from '../../../lib/types';

/**
 * Home do LOJISTA redesenhada (F2 — Dashboards/Home, node 2478:111).
 *
 * Reaproveita a mesma casca das homes do novo escopo (HomeTopBar navy → AppDrawer
 * + sino → NotificationModal, exatamente como a home do cliente da Task 4) e troca
 * a camada visual antiga por um painel de indicadores: avatar do negócio, card de
 * meta (GoalOverview), quatro KPIs (KpiCard), "Próximos agendamentos" e o donut de
 * receita por serviço (RevenueDonut).
 *
 * Fonte dos dados (Supabase, consultas locais — NÃO usa `useMerchantMetrics`,
 * para não acoplar a tela de métricas):
 * - business_profiles → perfil do negócio (nome/logo).
 * - appointments (janela mês anterior→mês corrente) → receita/contagem/donut.
 * - appointments (a partir de agora, exceto cancelados) → "Próximos agendamentos".
 * - appointments (só os clientes do mês, agendamentos ANTERIORES ao mês) →
 *   "Novos clientes" (clientes cujo 1º agendamento cai no mês).
 * - reviews → média de avaliação.
 * - referrals → indicações do mês.
 *
 * Definição de RECEITA (única no app, alinhada a `useMerchantMetrics`): agendamentos
 * com status 'confirmed' ou 'completed' e `service.price`. O "Realizado" do mês
 * corrente considera apenas o que JÁ ocorreu (start_time <= agora) — agendamentos
 * futuros do mês não inflam a receita realizada (a pacing do GoalOverview depende
 * disso). A contagem "Agendamentos" usa o mesmo filtro de status.
 */

// Status que contam como receita/agendamento (mesma definição de useMerchantMetrics).
const REVENUE_STATUSES = ['confirmed', 'completed'];

// Variação exibida no badge do KpiCard (ou null para escondê-lo).
type Delta = { text: string; up: boolean } | null;

// ── Shapes das linhas das consultas (o join do Supabase pode vir objeto ou array) ──
interface JoinedService {
  id: number;
  name: string;
  price: number | null;
}
type MaybeJoined<T> = T | T[] | null;

interface MetricsRow {
  start_time: string;
  status: string;
  client_id: string | null;
  service: MaybeJoined<JoinedService>;
}
interface UpcomingRow {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  service: MaybeJoined<JoinedService>;
  client: MaybeJoined<{ id: string; full_name: string | null }>;
}
interface ReviewRow {
  rating: number | null;
}
interface ReferralRow {
  created_at: string | null;
}

// Item já normalizado da lista "Próximos agendamentos".
interface UpcomingAppointment {
  id: number;
  start_time: string;
  serviceName: string;
  clientName: string;
}

// Normaliza um join to-one que o Supabase às vezes entrega como array de 1.
function firstOf<T>(value: MaybeJoined<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Variação percentual (ex.: "+12%") — usada em "Agendamentos".
function pctDelta(delta: { pct: number; up: boolean } | null): Delta {
  if (delta === null) return null;
  return { text: `${delta.pct > 0 ? '+' : ''}${delta.pct}%`, up: delta.up };
}

// Variação absoluta (ex.: "+3") — usada em "Indicações" e "Novos clientes".
function absDelta(delta: { abs: number; up: boolean } | null): Delta {
  if (delta === null) return null;
  return { text: `${delta.abs > 0 ? '+' : ''}${delta.abs}`, up: delta.up };
}

const MerchantHomeScreen: React.FC = () => {
  const router = useRouter();
  const { unreadCount, refreshNotifications } = useNotifications();
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<Business | null>(null);
  const [monthOverview, setMonthOverview] = useState<MonthOverview | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [donut, setDonut] = useState<{ total: number; segments: RevenueSegment[] }>({
    total: 0,
    segments: [],
  });
  const [kpis, setKpis] = useState<{
    agendamentos: { value: string; delta: Delta };
    avaliacao: { value: string; delta: Delta };
    indicacoes: { value: string; delta: Delta };
    novosClientes: { value: string; delta: Delta };
  }>({
    agendamentos: { value: '0', delta: null },
    avaliacao: { value: '—', delta: null },
    indicacoes: { value: '0', delta: null },
    novosClientes: { value: '0', delta: null },
  });

  // Menu lateral (AppDrawer) e modal de notificações — donos do estado que a
  // HomeTopBar (genérica) apenas dispara via callbacks (idêntico à home do cliente).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          logger.debug('Usuário não autenticado');
          setLoading(false);
          return;
        }

        // 1. Perfil do negócio (mesma consulta/tratamento da home antiga).
        const { data: businessData, error: businessError } = await supabase
          .from('business_profiles')
          .select('id, business_name, logo_url, description')
          .eq('owner_id', user.id)
          .single();

        if (businessError || !businessData) {
          if (businessError?.code === 'PGRST116') {
            Alert.alert(
              'Perfil não encontrado',
              'Você precisa criar um perfil de negócio primeiro.',
              [{ text: 'OK', onPress: () => router.push('/(merchant)/profile/edit') }],
            );
          } else if (businessError) {
            logger.error('Erro ao buscar negócio:', businessError);
          }
          setLoading(false);
          return;
        }

        setBusinessProfile(businessData as Business);

        // ── Janelas de data (fonte única) ──
        // Mês corrente e anterior alimentam a meta (GoalOverview) e os deltas dos
        // KPIs; os últimos 30 dias alimentam o donut (mantém honesta a legenda
        // "Últimos 30 dias" do card).
        const now = new Date();
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const startOfPreviousMonth = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
          0,
          0,
          0,
          0,
        );
        const endOfCurrentMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // 2. Consultas independentes em paralelo.
        const [metricsRes, upcomingRes, reviewsRes, referralsRes] = await Promise.all([
          // Métricas: janela [mês anterior, fim do mês corrente]. Ordena DESC + teto
          // alto para que, em lojas movimentadas, o truncamento derrube os meses mais
          // ANTIGOS (fora da janela útil) e nunca o mês corrente.
          supabase
            .from('appointments')
            .select('id, start_time, status, client_id, service:services(id, name, price)')
            .eq('business_id', businessData.id)
            .gte('start_time', startOfPreviousMonth.toISOString())
            .lte('start_time', endOfCurrentMonth.toISOString())
            .order('start_time', { ascending: false })
            .limit(2000),
          // Próximos agendamentos (a partir de agora, exceto cancelados) com o cliente.
          supabase
            .from('appointments')
            .select(
              'id, start_time, end_time, status, service:services(id, name), client:profiles!appointments_client_id_fkey(id, full_name)',
            )
            .eq('business_id', businessData.id)
            .gte('start_time', now.toISOString())
            .neq('status', 'canceled')
            .order('start_time', { ascending: true })
            .limit(10),
          // Avaliações do negócio (média).
          supabase.from('reviews').select('rating').eq('business_id', businessData.id),
          // Indicações do lojista (usuário) — contagem mensal + delta.
          supabase.from('referrals').select('created_at').eq('referrer_id', user.id),
        ]);

        const metricsRows = (metricsRes.data ?? []) as MetricsRow[];
        const upcomingRows = (upcomingRes.data ?? []) as UpcomingRow[];
        const reviewRows = (reviewsRes.data ?? []) as ReviewRow[];
        const referralRows = (referralsRes.data ?? []) as ReferralRow[];

        // ── Receita, contagem, donut e clientes do mês (partição no cliente) ──
        // Só agendamentos 'confirmed'/'completed' contam (cancelados/pendentes fora).
        let currentRevenue = 0;
        let previousRevenue = 0;
        let currentCount = 0;
        let previousCount = 0;
        const donutRows: ServiceRevenueRow[] = [];
        // Clientes distintos com agendamento no mês (base do "Novos clientes").
        const currentMonthClientIds = new Set<string>();
        const previousMonthClientIds = new Set<string>();

        for (const row of metricsRows) {
          if (!REVENUE_STATUSES.includes(row.status)) continue;
          const start = new Date(row.start_time);
          const service = firstOf(row.service);
          const price = service?.price ?? 0;
          const inCurrentMonth = start >= startOfCurrentMonth && start <= endOfCurrentMonth;
          const inPreviousMonth = start >= startOfPreviousMonth && start < startOfCurrentMonth;

          if (inCurrentMonth) {
            currentCount += 1;
            if (row.client_id) currentMonthClientIds.add(row.client_id);
            // "Realizado" = apenas o que JÁ ocorreu (start <= agora); agendamentos
            // futuros do mês não inflam a receita realizada (igual useMerchantMetrics).
            if (start <= now) currentRevenue += price;
          } else if (inPreviousMonth) {
            previousCount += 1;
            if (row.client_id) previousMonthClientIds.add(row.client_id);
            previousRevenue += price;
          }

          // Donut = receita realizada dos últimos 30 dias, por serviço.
          if (service?.name && start >= last30Start && start <= now) {
            donutRows.push({ serviceName: service.name, amount: price });
          }
        }

        setMonthOverview(
          computeMonthOverview({ currentRevenue, previousRevenue, dayOfMonth, daysInMonth }),
        );
        setDonut(groupRevenueByService(donutRows));

        // ── KPI: Avaliação (média). Delta absoluto não é barato (exigiria média
        // por período com reviews datadas) → degrada para null (esconde o badge). ──
        const ratings = reviewRows
          .map((r) => r.rating)
          .filter((r): r is number => typeof r === 'number');
        const ratingValue =
          ratings.length > 0
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
            : '—';

        // ── KPI: Indicações (indicações do mês vs mês anterior) ──
        let referralsCurrent = 0;
        let referralsPrevious = 0;
        for (const ref of referralRows) {
          if (!ref.created_at) continue;
          const created = new Date(ref.created_at);
          if (created >= startOfCurrentMonth && created <= endOfCurrentMonth) referralsCurrent += 1;
          else if (created >= startOfPreviousMonth && created < startOfCurrentMonth)
            referralsPrevious += 1;
        }

        // ── KPI: Novos clientes (clientes cujo 1º agendamento cai no mês) ──
        // Em vez de varrer todo o histórico (que truncaria em lojas grandes),
        // perguntamos APENAS pelos clientes do mês: quais já tinham agendamento
        // ANTES do início do mês? Quem não tinha é "novo". Consulta limitada ao
        // conjunto (pequeno) de clientes do mês.
        const fetchPriorClientIds = async (
          clientIds: string[],
          before: Date,
        ): Promise<Set<string>> => {
          const prior = new Set<string>();
          if (clientIds.length === 0) return prior;
          const { data } = await supabase
            .from('appointments')
            .select('client_id')
            .eq('business_id', businessData.id)
            .in('client_id', clientIds)
            .lt('start_time', before.toISOString());
          for (const r of (data ?? []) as Array<{ client_id: string | null }>) {
            if (r.client_id) prior.add(r.client_id);
          }
          return prior;
        };

        const [priorCurrent, priorPrevious] = await Promise.all([
          fetchPriorClientIds([...currentMonthClientIds], startOfCurrentMonth),
          fetchPriorClientIds([...previousMonthClientIds], startOfPreviousMonth),
        ]);
        const newClientsCurrent = [...currentMonthClientIds].filter(
          (id) => !priorCurrent.has(id),
        ).length;
        const newClientsPrevious = [...previousMonthClientIds].filter(
          (id) => !priorPrevious.has(id),
        ).length;

        setKpis({
          agendamentos: {
            value: String(currentCount),
            delta: pctDelta(computeDelta(currentCount, previousCount)),
          },
          avaliacao: { value: ratingValue, delta: null },
          indicacoes: {
            value: String(referralsCurrent),
            delta: absDelta(computeDelta(referralsCurrent, referralsPrevious)),
          },
          novosClientes: {
            value: String(newClientsCurrent),
            delta: absDelta(computeDelta(newClientsCurrent, newClientsPrevious)),
          },
        });

        // ── Próximos agendamentos (máx. 3), aplicando reagendamentos aceitos ──
        // Exclui cancelados (defensivo, além do filtro na consulta).
        const futureRows = upcomingRows.filter(
          (a) => new Date(a.start_time) >= now && a.status !== 'canceled',
        );
        const withReschedules = await applyAcceptedReschedules(futureRows);
        const upcomingList: UpcomingAppointment[] = withReschedules
          .filter((a) => new Date(a.start_time) >= now)
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 3)
          .map((a) => {
            const service = firstOf(a.service);
            const client = firstOf(a.client);
            return {
              id: a.id,
              start_time: a.start_time,
              serviceName: service?.name || 'Serviço',
              clientName: client?.full_name || 'Cliente',
            };
          });
        setUpcoming(upcomingList);
      } catch (error) {
        // Falha de carga → avisa o lojista (senão os zeros parecem métricas reais).
        logger.error('Erro ao carregar dados da home do lojista:', error);
        showError('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // `router`/`showError` são estáveis — mantê-los fora das deps evita recriar
    // loadData a cada render (o que dispararia o useEffect em loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Load inicial (mount) — fonte do carregamento nos testes.
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh silencioso ao reganhar foco (mantém o comportamento da home antiga).
  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
  }, [loadData]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openNotifications = useCallback(() => setNotifModalVisible(true), []);
  // Ao fechar o modal, recarrega a contagem — mesmo fluxo da home do cliente.
  const closeNotifications = useCallback(() => {
    setNotifModalVisible(false);
    refreshNotifications();
  }, [refreshNotifications]);

  // Itens do menu (drawer) do lojista — os MESMOS do "Aqui e Agora", acrescidos
  // de "Compartilhar perfil" (a seção que saiu da home migra para o drawer;
  // "Serviços" já fazia parte do conjunto).
  const drawerItems: DrawerItem[] = useMemo(
    () => [
      { label: 'Início', route: '/(merchant)/home' },
      { label: 'Agenda', route: '/(merchant)/dashboard' },
      { label: 'Serviços', route: '/(merchant)/services' },
      { label: 'Compartilhar perfil', route: '/(merchant)/home/share' },
      { label: 'Perfil', route: '/(merchant)/profile' },
      { label: 'Configurações', route: '/(merchant)/settings' },
    ],
    [],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  const businessName = businessProfile?.business_name || 'Meu Negócio';

  return (
    <>
      <ScreenContainer
        scroll={true}
        hasHeader={true}
        backgroundColor={colors.background}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        header={
          <HomeTopBar
            onMenu={openDrawer}
            onBell={openNotifications}
            notificationCount={unreadCount}
          />
        }
      >
        {/* Avatar: logo 40px (ou iniciais) + nome do negócio. */}
        <View style={styles.avatarSection}>
          {businessProfile?.logo_url ? (
            <Image source={{ uri: businessProfile.logo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{getInitials(businessName)}</Text>
            </View>
          )}
          <Text style={styles.businessName} numberOfLines={1}>
            {businessName}
          </Text>
        </View>

        {/* Card de meta do mês — toque no cabeçalho vai para a tela de métricas. */}
        <GoalOverview
          overview={monthOverview}
          onPress={() => router.push('/(merchant)/settings/metrics')}
        />

        {/* Grade de KPIs (2 por linha). Ícones do design system (sem assets do Figma). */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KpiCard
              testID="kpi-agendamentos"
              style={styles.kpiCard}
              icon={<Icon name="date-range" size={20} color={colors.brand} />}
              label="Agendamentos"
              value={kpis.agendamentos.value}
              delta={kpis.agendamentos.delta}
            />
            <KpiCard
              testID="kpi-avaliacao"
              style={styles.kpiCard}
              icon={<Icon name="star" size={20} color={colors.brand} />}
              label="Avaliação"
              value={kpis.avaliacao.value}
              delta={kpis.avaliacao.delta}
            />
          </View>
          <View style={styles.kpiRow}>
            <KpiCard
              testID="kpi-indicacoes"
              style={styles.kpiCard}
              icon={<Icon name="handshake" size={20} color={colors.brand} />}
              label="Indicações"
              value={kpis.indicacoes.value}
              delta={kpis.indicacoes.delta}
            />
            <KpiCard
              testID="kpi-novos-clientes"
              style={styles.kpiCard}
              icon={<Icon name="account-circle" size={20} color={colors.brand} />}
              label="Novos clientes"
              value={kpis.novosClientes.value}
              delta={kpis.novosClientes.delta}
            />
          </View>
        </View>

        {/* Próximos agendamentos — linhas no estilo do Figma; toque → detalhe. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próximos agendamentos</Text>
          {upcoming.length > 0 ? (
            <View style={styles.apptList}>
              {upcoming.map((appt) => {
                const time = new Date(appt.start_time).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });
                return (
                  <Pressable
                    key={appt.id}
                    testID={`upcoming-appt-${appt.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${appt.serviceName}, ${appt.clientName}, ${time}`}
                    style={styles.apptRow}
                    onPress={() => router.push(`/(merchant)/dashboard/appointment/${appt.id}`)}
                  >
                    <View style={styles.apptHeader}>
                      <Text style={styles.apptService} numberOfLines={1}>
                        {appt.serviceName}
                      </Text>
                      <Text style={styles.apptClient} numberOfLines={1}>
                        {appt.clientName}
                      </Text>
                    </View>
                    <View style={styles.apptContent}>
                      <Icon name="content-cut" size={24} color={colors.brand} />
                      <Text style={styles.apptTime}>{time}</Text>
                      <Icon name="chevron-right" size={22} color={colors.neutral400} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Você ainda não tem agendamentos futuros, divulgue seu perfil para receber mais clientes
            </Text>
          )}

          {/* Botão fantasma "Ver todos" → agenda completa (sempre visível). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver todos os agendamentos"
            style={styles.ghostButton}
            onPress={() => router.push('/(merchant)/dashboard')}
          >
            <Text style={styles.ghostButtonText}>Ver todos</Text>
          </Pressable>
        </View>

        {/* Receita por serviço (últimos 30 dias). */}
        <RevenueDonut total={donut.total} segments={donut.segments} />

        {/* TODO(F6): FAB de posts (criação de post é F6) */}
      </ScreenContainer>

      {/* Menu lateral e modal de notificações — irmãos do ScreenContainer para
          não viverem dentro do ScrollView. */}
      <AppDrawer visible={drawerOpen} onClose={closeDrawer} items={drawerItems} />
      <NotificationModal
        visible={notifModalVisible}
        onClose={closeNotifications}
        onNotificationsUpdated={refreshNotifications}
      />
    </>
  );
};

export default MerchantHomeScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.brand,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 24,
  },
  // ── Avatar ──
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarFallback: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.brand,
  },
  businessName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  // ── KPIs ──
  kpiGrid: {
    gap: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
  },
  // ── Seções ──
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  // ── Próximos agendamentos ──
  apptList: {
    gap: 8,
  },
  apptRow: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.textPrimary,
  },
  apptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  apptService: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: colors.neutral400,
  },
  apptClient: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textPrimary,
  },
  apptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 40,
  },
  apptTime: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  // ── Botão fantasma "Ver todos" ──
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  ghostButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});
