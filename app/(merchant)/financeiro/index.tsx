// F3: dados 100% do WalletService mock; a unificação com o backend é F8.
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useWalletService } from '../../../context/ServicesContext';
import { useNotifications } from '../../../context/NotificationContext';
import type { PixKey, WalletEntry } from '../../../lib/services/types';
import { HomeTopBar } from '../../../components/home/HomeTopBar';
import { AppDrawer, DrawerItem } from '../../../components/layout/AppDrawer';
import NotificationModal from '../../../components/notifications/NotificationModal';
import { PixKeySection } from '../../../components/wallet/PixKeySection';
import { StatementTimeline } from '../../../components/wallet/StatementTimeline';
import {
  EarningsLineChart,
  type EarningsPoint,
} from '../../../components/dashboard/EarningsLineChart';
import { RevenueDonut } from '../../../components/dashboard/RevenueDonut';
import { groupRevenueByService, type RevenueSegment } from '../../../lib/dashboardMetrics';
import { formatBRL } from '../../../lib/formatters';
import { colors } from '../../../lib/theme';

// Itens do menu (drawer) do lojista — os MESMOS da home/aqui-agora, acrescidos
// de "Financeiro" (esta tela). Constante de módulo: não realoca a cada render.
const DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Início', route: '/(merchant)/home' },
  { label: 'Agenda', route: '/(merchant)/dashboard' },
  { label: 'Serviços', route: '/(merchant)/services' },
  { label: 'Financeiro', route: '/(merchant)/financeiro' },
  { label: 'Perfil', route: '/(merchant)/profile' },
  { label: 'Configurações', route: '/(merchant)/settings' },
];

// Quantidade de lançamentos exibida antes de expandir o extrato completo.
const STATEMENT_PREVIEW = 4;

// Extrato em ordem decrescente por data. Strings ISO 8601 ordenam
// lexicograficamente = cronologicamente, então localeCompare basta.
function sortStatementDesc(statement: WalletEntry[]): WalletEntry[] {
  return [...statement].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Pontos do gráfico "Faturamento" derivados APENAS dos CRÉDITOS do extrato
 * (amountCents > 0 — saques são débitos e não entram no faturamento). Agrupa por
 * DIA (chave yyyy-MM-dd para ordenar cronologicamente; rótulo dd/MM para o eixo
 * x), soma os centavos do dia e ordena ascendente por data. `totalCents` é a soma
 * de todos os créditos do período.
 */
function deriveEarnings(statement: WalletEntry[]): {
  points: EarningsPoint[];
  totalCents: number;
} {
  const credits = statement.filter((entry) => entry.amountCents > 0);
  const byDay = new Map<string, { label: string; valueCents: number }>();
  for (const entry of credits) {
    const day = parseISO(entry.date);
    const key = format(day, 'yyyy-MM-dd');
    const label = format(day, 'dd/MM');
    const existing = byDay.get(key);
    if (existing) {
      existing.valueCents += entry.amountCents;
    } else {
      byDay.set(key, { label, valueCents: entry.amountCents });
    }
  }
  const points = [...byDay.entries()]
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([, value]) => ({ label: value.label, valueCents: value.valueCents }));
  const totalCents = credits.reduce((acc, entry) => acc + entry.amountCents, 0);
  return { points, totalCents };
}

/**
 * Composição do donut "Receita por serviço": entradas de serviço/fura-fila
 * mapeadas para linhas de receita EM REAIS (o donut formata com formatReais) e
 * agrupadas por `groupRevenueByService` (top 3 + "Outros").
 */
function deriveRevenue(statement: WalletEntry[]): { total: number; segments: RevenueSegment[] } {
  const rows = statement
    .filter((entry) => entry.kind === 'service' || entry.kind === 'fura_fila')
    .map((entry) => ({ serviceName: entry.title, amount: entry.amountCents / 100 }));
  return groupRevenueByService(rows);
}

/**
 * Financeiro do LOJISTA (F3 — Carteira/Financeiro, Task 8, Figma nodes 2602:5991
 * completo e 2597:5956 vazio).
 *
 * Mesma casca das homes do novo escopo: HomeTopBar navy (menu → AppDrawer com os
 * itens do lojista + "Financeiro"; sino → NotificationModal, espelhando a home do
 * lojista). Abaixo, um hero navy com o saldo disponível e o botão "Solicitar
 * Saque", seguido das seções empilhadas: "Chaves Pix" (PixKeySection), "Extrato"
 * (StatementTimeline, prévia de 4 + expandir inline), "Faturamento"
 * (EarningsLineChart) e "Receita por serviço" (RevenueDonut).
 *
 * NOTA DE DESIGN: o Figma desta tela desenha só o hambúrguer na top bar; aqui
 * mantemos também o sino, para consistência com a home do lojista (decisão de
 * escopo, conforme a especificação da Task 8).
 *
 * Carrega saldo, extrato e chaves Pix em paralelo via WalletService, recarregando
 * ao focar (useFocusEffect) para refletir uma chave recém-cadastrada (new-pix-key)
 * ou um saque (Task 9). Um `active`-guard evita setState após desmontar; `loaded`
 * segura o spinner só no primeiro load.
 */
const MerchantFinanceiroScreen: React.FC = () => {
  const router = useRouter();
  const walletService = useWalletService();
  const { unreadCount, refreshNotifications } = useNotifications();

  // AppDrawer e NotificationModal são donos do próprio estado; a HomeTopBar só
  // dispara os callbacks (idêntico à home do lojista).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [balanceCents, setBalanceCents] = useState(0);
  const [statement, setStatement] = useState<WalletEntry[]>([]);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);

  // Recarrega os três recursos ao focar (mount inclusive). Depois do primeiro
  // load, `loaded` permanece true — refocos só atualizam os dados, sem repor o
  // spinner (evita flash ao voltar de uma tela de cadastro/saque).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [balanceResult, statementResult, pixResult] = await Promise.all([
            walletService.getMerchantBalanceCents(),
            walletService.getMerchantStatement(),
            walletService.getPixKeys(),
          ]);
          if (!active) return;
          setBalanceCents(balanceResult);
          setStatement(statementResult);
          setPixKeys(pixResult);
        } finally {
          if (active) setLoaded(true);
        }
      })();
      return () => {
        active = false;
      };
    }, [walletService]),
  );

  const sorted = useMemo(() => sortStatementDesc(statement), [statement]);
  const visibleEntries = useMemo(
    () => (expanded ? sorted : sorted.slice(0, STATEMENT_PREVIEW)),
    [sorted, expanded],
  );
  const hasMore = sorted.length > STATEMENT_PREVIEW;

  const earnings = useMemo(() => deriveEarnings(statement), [statement]);
  const revenue = useMemo(() => deriveRevenue(statement), [statement]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openNotifications = useCallback(() => setNotifModalVisible(true), []);
  // Ao fechar o modal, recarrega a contagem — mesmo fluxo da home do lojista.
  const closeNotifications = useCallback(() => {
    setNotifModalVisible(false);
    refreshNotifications();
  }, [refreshNotifications]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  // Saldo formatado a partir de centavos: "R$ 591,20". Renderizamos a parte
  // inteira em 32 e os centavos em 24 (Figma), mantendo tudo num único Text para
  // que "591,20" permaneça contíguo.
  const formattedBalance = formatBRL(balanceCents);
  const commaIndex = formattedBalance.lastIndexOf(',');
  const balanceInt =
    commaIndex === -1 ? formattedBalance : formattedBalance.slice(0, commaIndex);
  const balanceCentsPart = commaIndex === -1 ? '' : formattedBalance.slice(commaIndex);

  return (
    <>
      <View style={styles.root}>
        <HomeTopBar
          onMenu={openDrawer}
          onBell={openNotifications}
          notificationCount={unreadCount}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero navy: saldo disponível + botão "Solicitar Saque". */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Saldo disponível</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroBalanceInt} testID="merchant-balance">
                {balanceInt}
                <Text style={styles.heroBalanceCents}>{balanceCentsPart}</Text>
              </Text>
              <Pressable
                testID="btn-withdraw"
                accessibilityRole="button"
                accessibilityLabel="Solicitar saque"
                onPress={() => router.push('/(merchant)/financeiro/withdraw')}
                style={styles.withdrawButton}
              >
                <Text style={styles.withdrawLabel}>Solicitar Saque</Text>
              </Pressable>
            </View>
          </View>

          {/* Corpo com padding próprio (o hero sangra até as bordas). */}
          <View style={styles.body}>
            {/* Chaves Pix — lista + botão "Adicionar chave Pix". */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chaves Pix</Text>
              <PixKeySection
                keys={pixKeys}
                onAddPress={() => router.push('/(merchant)/financeiro/new-pix-key')}
              />
            </View>

            {/* Extrato — prévia de 4; expande inline (sem nova rota) se houver mais. */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Extrato</Text>
              <StatementTimeline
                entries={visibleEntries}
                emptyMessage="Nenhum lançamento encontrado"
              />
              {hasMore && !expanded ? (
                <Pressable
                  testID="btn-expand-statement"
                  accessibilityRole="button"
                  accessibilityLabel="Ver extrato completo"
                  onPress={() => setExpanded(true)}
                  style={styles.ghostButton}
                >
                  <Text style={styles.ghostButtonText}>Ver extrato completo</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Faturamento — série dos créditos do extrato, agrupados por dia.
                deltaPct={null}: o mock não tem período anterior honesto para
                comparar, então escondemos o badge de tendência (unificação em F8). */}
            <EarningsLineChart
              points={earnings.points}
              totalCents={earnings.totalCents}
              deltaPct={null}
            />

            {/* Receita por serviço — donut reaproveitado (F2), valores em reais. */}
            <RevenueDonut total={revenue.total} segments={revenue.segments} />
          </View>
        </ScrollView>
      </View>

      {/* Menu lateral e modal de notificações — irmãos da View raiz para não
          viverem dentro do ScrollView. */}
      <AppDrawer visible={drawerOpen} onClose={closeDrawer} items={DRAWER_ITEMS} />
      <NotificationModal
        visible={notifModalVisible}
        onClose={closeNotifications}
        onNotificationsUpdated={refreshNotifications}
      />
    </>
  );
};

export default MerchantFinanceiroScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40, // respiro sob a tab bar flutuante
  },
  // ── Hero navy (saldo) ──────────────────────────────────────
  hero: {
    backgroundColor: colors.brand,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    gap: 4,
  },
  heroLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroBalanceInt: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    color: colors.contentPrimaryLight,
    flexShrink: 1,
  },
  heroBalanceCents: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: colors.contentPrimaryLight,
  },
  withdrawButton: {
    borderWidth: 1,
    borderColor: colors.contentLight,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  withdrawLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  // ── Corpo ──────────────────────────────────────────────────
  body: {
    paddingHorizontal: 24, // Figma padding/l
    paddingTop: 20, // Figma padding/ml
    gap: 24, // Figma gap/l entre seções
  },
  section: {
    gap: 16, // Figma gap/m dentro da seção
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  // ── Botão fantasma "Ver extrato completo" ──────────────────
  ghostButton: {
    height: 44,
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
