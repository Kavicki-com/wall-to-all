import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatReais } from '../../lib/formatters';
import type { MonthOverview } from '../../lib/dashboardMetrics';

export interface GoalOverviewProps {
  /** Resumo do mês vindo de `computeMonthOverview`; null quando não há meta. */
  overview: MonthOverview | null;
  /** Toque no cabeçalho "Visão do mês" → futura tela de métricas. */
  onPress?: () => void;
}

/**
 * Card "Visão do mês" da home do lojista (F2 — Dashboards/Home, node 2478:181).
 *
 * Puramente apresentacional: recebe o `MonthOverview` já calculado por
 * `computeMonthOverview` e um `onPress` para o cabeçalho. Sem meta possível
 * (overview null) mostra um placeholder neutro em vez de números falsos.
 *
 * Layout (topo → base): cabeçalho tocável + chevron; linha de 3 estatísticas
 * (Previsão/Realizado/Faltam); barra de progresso; legenda de ritmo.
 */
export const GoalOverview: React.FC<GoalOverviewProps> = ({ overview, onPress }) => {
  const captionColor = overview?.onTrack ? colors.surfaceSuccess : colors.contentWarning;

  return (
    <View style={styles.container}>
      {/* ── Cabeçalho tocável → futura tela de métricas ── */}
      <Pressable
        testID="goal-overview-header"
        accessibilityRole="button"
        accessibilityLabel="Ver visão do mês"
        onPress={() => onPress?.()}
        style={styles.header}
      >
        <Text style={styles.title}>Visão do mês</Text>
        <Icon name="chevron-right" size={16} color={colors.accent} />
      </Pressable>

      {overview === null ? (
        // ── Estado neutro: sem mês anterior não há meta possível ──
        <Text testID="goal-overview-empty" style={styles.emptyText}>
          Sem histórico do mês anterior ainda
        </Text>
      ) : (
        <>
          {/* ── Estatísticas: Previsão / Realizado / Faltam ── */}
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Previsão</Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {formatReais(overview.forecast)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Realizado</Text>
              <Text style={[styles.statValue, { color: colors.brand }]}>
                {formatReais(overview.realized)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Faltam</Text>
              <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                {formatReais(overview.remaining)}
              </Text>
            </View>
          </View>

          {/* ── Barra de progresso (trilho + preenchimento limitado a 100%) ── */}
          <View style={styles.progressTrack}>
            <View
              testID="goal-progress-fill"
              style={[
                styles.progressFill,
                { width: `${Math.min(100, overview.pct)}%` },
              ]}
            />
          </View>

          {/* ── Legenda de ritmo: em dia (verde) vs corra atrás (alerta) ── */}
          <View testID="goal-caption" style={styles.caption}>
            <View style={[styles.captionDot, { backgroundColor: captionColor }]} />
            <Text style={[styles.captionText, { color: captionColor }]}>
              {overview.onTrack
                ? `${overview.pct}% da meta — você está em dia!`
                : `${overview.pct}% da meta — corra atrás!`}
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Estatísticas ──
  stats: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stat: {
    gap: 4,
  },
  statLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
  },

  // ── Barra de progresso ──
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceGrey,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSuccess,
  },

  // ── Legenda ──
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  captionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  captionText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
  },
});
