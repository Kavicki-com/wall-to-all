import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';

export interface KpiCardProps {
  /** Ícone do indicador; o chamador passa o elemento pronto. */
  icon: React.ReactNode;
  /** Rótulo do indicador (ex.: "Agendamentos"). */
  label: string;
  /** Valor já formatado pelo chamador (ex.: "24", "4.8", "R$ 1.200"). */
  value: string;
  /** Variação vs período anterior; null esconde o badge. */
  delta: { text: string; up: boolean } | null;
  /** Estilo extra do card (ex.: largura/flex na grade da home). */
  style?: StyleProp<ViewStyle>;
  /** testID opcional para asserção nos testes/telas. */
  testID?: string;
}

/**
 * Cartão de indicador (KPI) da home do lojista (F2 — Dashboards/Home, node 2482:2).
 *
 * Puramente apresentacional: ícone + rótulo + valor, com um badge de variação
 * opcional. Verde (surfaceSuccess) quando a variação sobe, vermelho de marca
 * (accent) quando cai. Sem `delta` não renderiza o badge.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  icon,
  label,
  value,
  delta,
  style,
  testID,
}) => {
  const deltaColor = delta?.up ? colors.surfaceSuccess : colors.accent;

  return (
    <View testID={testID} style={[styles.card, style]}>
      {icon}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {delta !== null && (
        <View testID="kpi-delta" style={styles.deltaRow}>
          <Icon
            name={delta.up ? 'trending-up' : 'trending-down'}
            size={16}
            color={deltaColor}
          />
          <Text style={[styles.deltaText, { color: deltaColor }]}>{delta.text}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 12,
    gap: 4,
    // Sombra sutil do Figma: 0px 4px 12px rgba(0,0,0,0.1) → colors.shadow.
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  value: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deltaText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
  },
});
