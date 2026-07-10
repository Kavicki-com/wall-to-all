import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, Line, Polyline, Path, Circle } from 'react-native-svg';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatReais } from '../../lib/formatters';

export interface EarningsPoint {
  /** Rótulo do eixo x (ex.: dia do mês "1".."30"). */
  label: string;
  /** Valor do ponto em CENTAVOS (domínio da carteira usa inteiros de centavos). */
  valueCents: number;
}

export interface EarningsLineChartProps {
  points: EarningsPoint[];
  /** Total do período, em CENTAVOS (exibido em reais, sem casas decimais). */
  totalCents: number;
  /** Variação % vs. período anterior; undefined/null → sem badge de tendência. */
  deltaPct?: number | null;
}

// ── Geometria do gráfico (viewBox interno; a Svg escala com width="100%") ──
const VIEW_W = 300; // largura lógica do viewBox
const VIEW_H = 132; // altura ~132px pedida no design
const PAD_X = 8; // respiro lateral p/ o Circle do último ponto não vazar
const PAD_TOP = 12; // respiro superior (topo da série)
const PAD_BOTTOM = 12; // respiro inferior (base da área)
const BASELINE = VIEW_H - PAD_BOTTOM; // y da base da área preenchida
const PLOT_H = BASELINE - PAD_TOP; // altura útil de plotagem
const DOT_RADIUS = 5; // raio do marcador no último ponto
// Frações verticais das linhas de grade (4 linhas horizontais).
const GRID_FRACTIONS = [0, 1 / 3, 2 / 3, 1];
const MAX_X_LABELS = 7; // amostra de até 7 rótulos no eixo x

/** x uniformemente espaçado; com 1 ponto, centraliza. */
function xAt(index: number, count: number): number {
  if (count <= 1) return VIEW_W / 2;
  return PAD_X + (index / (count - 1)) * (VIEW_W - 2 * PAD_X);
}

/** y normalizado pelo máximo (com guarda contra divisão por zero). */
function yAt(valueCents: number, maxCents: number): number {
  const safeMax = maxCents > 0 ? maxCents : 1;
  return PAD_TOP + (1 - valueCents / safeMax) * PLOT_H;
}

/**
 * Índices dos rótulos exibidos no eixo x: todos se houver ≤ 7 pontos; caso
 * contrário, amostra de 7 igualmente espaçados sempre com o primeiro e o último.
 */
function sampleLabelIndices(count: number): number[] {
  if (count <= MAX_X_LABELS) {
    return Array.from({ length: count }, (_, i) => i);
  }
  const step = (count - 1) / (MAX_X_LABELS - 1);
  const idxs = new Set<number>();
  for (let i = 0; i < MAX_X_LABELS; i++) {
    idxs.add(Math.round(i * step));
  }
  idxs.add(count - 1); // garante o último
  return Array.from(idxs).sort((a, b) => a - b);
}

/**
 * Card "Faturamento" do financeiro do lojista (F3 — Carteira/Financeiro, Task 7,
 * node 2602:6429).
 *
 * Apresentacional: um gráfico de linha com área preenchida (react-native-svg). O
 * y de cada ponto é normalizado pelo maior `valueCents` (guarda contra divisão
 * por zero) e o x é uniformemente espaçado. A `Polyline` desenha a série; um
 * `Path` fechado até a base pinta a área com baixa opacidade; um `Circle` marca o
 * último ponto. Rótulos do eixo x são amostrados (até 7, sempre com o 1º e o
 * último) e distribuídos com space-between.
 *
 * Estado vazio (sem pontos): mantém o cabeçalho (título + total) e mostra apenas
 * a mensagem "Sem dados no período".
 */
export const EarningsLineChart: React.FC<EarningsLineChartProps> = ({
  points,
  totalCents,
  deltaPct,
}) => {
  const isEmpty = points.length === 0;
  const totalLabel = formatReais(Math.round(totalCents / 100));
  const hasTrend = deltaPct !== undefined && deltaPct !== null;
  const isPositive = hasTrend && (deltaPct as number) >= 0;
  const trendColor = isPositive ? colors.surfaceSuccess : colors.accent;

  // Geometria da série (só quando há dados).
  const maxCents = isEmpty ? 0 : Math.max(...points.map((p) => p.valueCents));
  const coords = points.map((p, i) => ({
    x: xAt(i, points.length),
    y: yAt(p.valueCents, maxCents),
  }));
  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPath =
    coords.length > 0
      ? `M ${coords[0].x},${BASELINE} ` +
        coords.map((c) => `L ${c.x},${c.y}`).join(' ') +
        ` L ${coords[coords.length - 1].x},${BASELINE} Z`
      : '';
  const lastPoint = coords[coords.length - 1];
  const labelIndices = sampleLabelIndices(points.length);

  return (
    <View style={styles.card}>
      {/* Cabeçalho: título + seletor de período à esquerda, total + tendência à direita. */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Faturamento</Text>
          {/* Seletor de período DECORATIVO — estático nesta fase. */}
          {/* TODO(F8): seletor de período funcional */}
          <View style={styles.periodPill}>
            <Text style={styles.periodText}>30 dias</Text>
            {/* MaterialCommunityIcons: família que possui o glifo "chevron-down". */}
            <Icon
              name="chevron-down"
              family="MaterialCommunityIcons"
              size={14}
              color={colors.brand}
            />
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.total}>{totalLabel}</Text>
          {hasTrend && (
            <View style={styles.trendBadge}>
              <Icon
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={14}
                color={trendColor}
              />
              <Text style={[styles.trendText, { color: trendColor }]}>
                {`${isPositive ? '+' : ''}${deltaPct}%`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {isEmpty ? (
        <View testID="earnings-empty" style={styles.emptyBox}>
          <Text style={styles.emptyText}>Sem dados no período</Text>
        </View>
      ) : (
        <>
          {/* Corpo do gráfico: grade + área + linha + marcador do último ponto. */}
          <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            {GRID_FRACTIONS.map((frac, i) => {
              const y = PAD_TOP + frac * PLOT_H;
              return (
                <Line
                  key={i}
                  x1={0}
                  y1={y}
                  x2={VIEW_W}
                  y2={y}
                  stroke={colors.surfaceGrey}
                  strokeWidth={1}
                />
              );
            })}

            <Path d={areaPath} fill={colors.brand} fillOpacity={0.08} />

            <Polyline
              testID="earnings-line"
              points={linePoints}
              fill="none"
              stroke={colors.brand}
              strokeWidth={2}
            />

            {lastPoint && (
              <Circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={DOT_RADIUS}
                fill={colors.accent}
              />
            )}
          </Svg>

          {/* Rótulos do eixo x (amostra), distribuídos com space-between. */}
          <View style={styles.xAxis}>
            {labelIndices.map((idx) => (
              <Text key={idx} style={styles.xLabel}>
                {points[idx].label}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    // Sombra leve (colors.shadow) — igual à intenção do design.
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    gap: 8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.surfaceGrey,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  periodText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.brand,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  total: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.surfaceSuccess,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.textSecondary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
});
