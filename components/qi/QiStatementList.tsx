import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, isToday, parseISO } from 'date-fns';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import type { QiStatementEntry } from '../../lib/services/types';

export interface QiStatementListProps {
  /** Lançamentos do extrato da indicação, em ordem cronológica de exibição. */
  entries: QiStatementEntry[];
  /** testID opcional para asserção nos testes/telas. */
  testID?: string;
}

/**
 * Formata a data de um lançamento: se for hoje, "Hoje, HH:mm"; caso contrário,
 * "dd/MM/yyyy". "Hoje" é derivado via date-fns (`isToday`), não por comparação
 * manual com a data atual.
 */
function formatEntryDate(iso: string): string {
  const date = parseISO(iso);
  return isToday(date) ? format(date, "'Hoje,' HH:mm") : format(date, 'dd/MM/yyyy');
}

/**
 * Extrato ("Extrato") da tela de detalhes da indicação do QI (F4 — node
 * 2628:7181 do Figma). Timeline vertical: cada lançamento tem um ponto verde à
 * esquerda, ligado por um conector ao próximo (menos no último), e à direita o
 * título em negrito com o valor em verde, o subtítulo e a data formatada.
 * Componente puramente apresentacional.
 *
 * Contrato: o chamador (tela de detalhes) só renderiza este componente quando há
 * lançamentos — `entries` vazio produz um container vazio de propósito (sem
 * mensagem de vazio própria, diferente do `StatementTimeline` do Financeiro).
 */
export const QiStatementList: React.FC<QiStatementListProps> = ({ entries, testID }) => (
  <View testID={testID}>
    {entries.map((entry, index) => {
      const isLast = index === entries.length - 1;
      return (
        <View key={entry.id} style={styles.row}>
          {/* Coluna do ponto: ponto verde + conector vertical (menos na última linha). */}
          <View style={styles.dotColumn}>
            <View testID={`qi-statement-dot-${entry.id}`} style={styles.dot} />
            {!isLast && <View style={styles.connector} />}
          </View>

          {/* Conteúdo do lançamento. */}
          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={styles.title} numberOfLines={1}>
                {entry.title}
              </Text>
              <Text style={styles.amount}>{formatBRL(entry.amountCents)}</Text>
            </View>
            <Text style={styles.subtitle}>{entry.subtitle}</Text>
            <Text style={styles.date}>{formatEntryDate(entry.date)}</Text>
          </View>
        </View>
      );
    })}
  </View>
);

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
    backgroundColor: colors.surfaceSuccess,
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
    color: colors.surfaceSuccess,
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
});
