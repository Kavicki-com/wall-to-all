import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import type { QiSummary } from '../../lib/services/types';

export interface QiEarningsCardProps {
  /** Resumo do programa QI (saldo, lucro, indicados, bônus, próximo nível). */
  summary: QiSummary;
  /** testID opcional para asserção nos testes/telas. */
  testID?: string;
}

/**
 * Cartão "Ganhos por indicação" do QI (F4 — node 2628:6946 do Figma).
 *
 * Puramente apresentacional: cabeçalho com título e um chip decorativo
 * "Top Indicações", três indicadores (lucro total, indicados, bônus), uma barra
 * de progresso rumo ao próximo nível e a legenda da meta. Quando `nextLevel` é
 * `null` (nível máximo), não renderiza barra nem legenda.
 */
export const QiEarningsCard: React.FC<QiEarningsCardProps> = ({ summary, testID }) => {
  const { nextLevel } = summary;

  // Fração da barra, protegida contra meta 0/negativa e limitada a [0, 1].
  const progress =
    nextLevel && nextLevel.target > 0
      ? Math.min(1, Math.max(0, summary.indicadosCount / nextLevel.target))
      : 0;

  return (
    <View testID={testID} style={styles.card}>
      {/* Cabeçalho: ícone + título + chip decorativo */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name="handshake" size={18} color={colors.accent} />
          <Text style={styles.title}>Ganhos por indicação</Text>
        </View>
        {/* TODO(F8): "Top Indicações" é decorativo por enquanto — sem ação. */}
        <View style={styles.chip}>
          <Text style={styles.chipText}>Top Indicações</Text>
        </View>
      </View>

      {/* Indicadores */}
      <View style={styles.statsRow}>
        <Stat value={formatBRL(summary.totalEarnedCents)} label="Lucro total" />
        <Stat value={String(summary.indicadosCount)} label="Indicados" />
        <Stat value={String(summary.bonusCount)} label="Bônus" />
      </View>

      {/* Progresso + legenda do próximo nível (ocultos no nível máximo) */}
      {nextLevel && (
        <>
          <View testID="qi-progress-bar" style={styles.progressTrack}>
            <View
              testID="qi-progress-fill"
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={styles.legend}>
            {`Indique ${nextLevel.target} amigos para liberar nível `}
            <Text style={styles.levelName}>{nextLevel.name}</Text>
          </Text>
        </>
      )}
    </View>
  );
};

/** Coluna de indicador: estrela + valor em negrito e rótulo abaixo. */
const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={styles.stat}>
    <View style={styles.statValueRow}>
      <Icon name="star" size={12} color={colors.contentWarning} />
      <Text style={styles.statValue}>{value}</Text>
    </View>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.accent,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.brand,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.surfaceGrey,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  legend: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  levelName: {
    color: colors.contentWarning,
  },
});
