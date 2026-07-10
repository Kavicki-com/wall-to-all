import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, Circle, G } from 'react-native-svg';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatReais } from '../../lib/formatters';
import type { RevenueSegment } from '../../lib/dashboardMetrics';

export interface RevenueDonutProps {
  /** Receita total do período (soma dos segmentos). */
  total: number;
  /** Segmentos já agrupados/ordenados por groupRevenueByService (top 3 + "Outros"). */
  segments: RevenueSegment[];
}

// ── Geometria do donut ────────────────────────────────────
const DONUT_SIZE = 110;
const RADIUS = 44;
const CENTER = 55; // cx = cy
const STROKE_WIDTH = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Cores dos segmentos NA ORDEM do design (ciclam caso algum dia haja > 4).
const SEGMENT_COLORS = [
  colors.surfaceSuccess,
  colors.contentWarning,
  colors.accent,
  colors.contentInfo,
];

/**
 * Card "Receita por serviço" da home do lojista (F2 — Dashboards/Home, node 2478:200).
 *
 * Apresentacional: um donut de composição (react-native-svg) com o total no
 * centro, mais uma legenda com participação e valor de cada segmento. Os
 * segmentos já vêm agrupados/ordenados por `groupRevenueByService`.
 *
 * Cada arco é um `Circle` com `strokeDasharray` proporcional ao percentual e um
 * `strokeDashoffset` acumulado, para que os segmentos fiquem ponta a ponta. O
 * `<G rotation={-90}>` gira o traçado para começar às 12h.
 *
 * Estado vazio (sem segmentos ou total zero): mantém o cabeçalho e mostra apenas
 * a mensagem "Sem receita nos últimos 30 dias".
 */
export const RevenueDonut: React.FC<RevenueDonutProps> = ({ total, segments }) => {
  const isEmpty = segments.length === 0 || total === 0;

  // Offsets acumulados: cada arco começa onde o anterior terminou.
  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const dash = (seg.pct / 100) * CIRCUMFERENCE;
    const offset = -cumulative;
    cumulative += dash;
    return { dash, offset, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] };
  });

  return (
    <View style={styles.card}>
      {/* Cabeçalho: título + botão decorativo (sem ação). */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Receita por serviço</Text>
          <Text style={styles.subtitle}>Últimos 30 dias</Text>
        </View>
        <View style={styles.iconButton}>
          <Icon name="trending-up" size={18} color={colors.contentLight} />
        </View>
      </View>

      {isEmpty ? (
        <View testID="donut-empty" style={styles.emptyBox}>
          <Text style={styles.emptyText}>Sem receita nos últimos 30 dias</Text>
        </View>
      ) : (
        <View style={styles.body}>
          {/* Donut à esquerda, com o total sobreposto ao centro. */}
          <View style={styles.donut}>
            <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
              <G rotation={-90} originX={CENTER} originY={CENTER}>
                {arcs.map((arc, i) => (
                  <Circle
                    key={i}
                    testID={`donut-segment-${i}`}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${arc.dash} ${CIRCUMFERENCE}`}
                    strokeDashoffset={arc.offset}
                  />
                ))}
              </G>
            </Svg>
            <View style={styles.centerLabel} pointerEvents="none">
              <Text style={styles.centerCaption}>Total</Text>
              <Text style={styles.centerValue}>{formatReais(total)}</Text>
            </View>
          </View>

          {/* Legenda à direita: um item por segmento. */}
          <View style={styles.legend}>
            {segments.map((seg, i) => (
              <View
                key={i}
                testID={`donut-legend-${i}`}
                style={styles.legendRow}
              >
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] },
                  ]}
                />
                <View style={styles.legendText}>
                  <Text style={styles.legendLabel}>{seg.label}</Text>
                  <Text style={styles.legendMeta}>
                    {`${seg.pct}% • ${formatReais(seg.amount)}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  subtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donut: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    position: 'relative',
  },
  centerLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCaption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.textSecondary,
  },
  centerValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  legend: {
    flex: 1,
    marginLeft: 16,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    gap: 0,
  },
  legendLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  legendMeta: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.textSecondary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
});
