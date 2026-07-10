import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import type { WalletEntry, WalletEntryKind } from '../../lib/services/types';

export interface StatementTimelineProps {
  entries: WalletEntry[];
  emptyMessage: string;
  testID?: string;
}

// Aparência do ponto por tipo de lançamento: cor de fundo, glifo e cor do glifo.
const DOT_STYLES: Record<
  WalletEntryKind,
  { background: string; glyph: string; glyphColor: string }
> = {
  service: { background: colors.surfaceSuccess, glyph: '$', glyphColor: colors.contentLight },
  fura_fila: { background: colors.surfaceWarningLight, glyph: '★', glyphColor: colors.contentWarning },
  withdraw: { background: colors.surfaceGrey, glyph: '↓', glyphColor: colors.textSecondary },
};

/**
 * Extrato: lista vertical de lançamentos da carteira. Cada linha exibe um ponto
 * colorido à esquerda (ligado por uma linha vertical ao próximo, exceto no
 * último) e o conteúdo à direita: título + valor com sinal, subtítulo e data.
 *
 * Crédito (amountCents >= 0) aparece em verde com "+"; débito (saque) em
 * vermelho com "-". Componente puramente apresentacional.
 */
export const StatementTimeline: React.FC<StatementTimelineProps> = ({
  entries,
  emptyMessage,
  testID,
}) => {
  if (entries.length === 0) {
    return (
      <View testID={testID}>
        <Text style={styles.emptyMessage} testID="statement-empty">
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <View testID={testID}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const dot = DOT_STYLES[entry.kind];
        const isCredit = entry.amountCents >= 0;
        const amountLabel = isCredit
          ? `+${formatBRL(entry.amountCents)}`
          : `-${formatBRL(Math.abs(entry.amountCents))}`;

        return (
          <View key={entry.id} style={styles.row}>
            {/* Coluna do ponto: ponto redondo + conector vertical (menos na última linha). */}
            <View style={styles.dotColumn}>
              <View
                testID={`dot-${entry.kind}`}
                style={[styles.dot, { backgroundColor: dot.background }]}
              >
                <Text style={[styles.dotGlyph, { color: dot.glyphColor }]}>{dot.glyph}</Text>
              </View>
              {!isLast && <View style={styles.connector} />}
            </View>

            {/* Conteúdo do lançamento. */}
            <View style={styles.content}>
              <View style={styles.topRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {entry.title}
                </Text>
                <Text
                  style={[styles.amount, { color: isCredit ? colors.surfaceSuccess : colors.accent }]}
                >
                  {amountLabel}
                </Text>
              </View>
              <Text style={styles.subtitle}>{entry.subtitle}</Text>
              <Text style={styles.date}>{format(parseISO(entry.date), 'dd/MM/yyyy')}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  dotColumn: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGlyph: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.surfaceGrey,
    marginTop: 4,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  amount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    marginLeft: 8,
  },
  subtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  date: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyMessage: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
});
