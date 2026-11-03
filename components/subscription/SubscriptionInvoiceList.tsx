import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import { formatSubscriptionDate } from '../../lib/subscription/formatDate';
import type { SubscriptionInvoice } from '../../lib/services/subscriptionTypes';

interface SubscriptionInvoiceListProps {
  /** Mais recente primeiro (contrato do SubscriptionService). */
  invoices: SubscriptionInvoice[];
}

/** Quantas faturas aparecem antes de "Ver todas as faturas" (Figma mostra 4). */
const COLLAPSED_COUNT = 4;

/**
 * "Histórico de cobranças" do Gerenciar (subscription-manage 2680:211): data,
 * valor e badge "Pago"/"Pendente". "Ver todas as faturas" expande na própria
 * tela e some quando não há mais o que mostrar.
 */
const SubscriptionInvoiceList: React.FC<SubscriptionInvoiceListProps> = ({ invoices }) => {
  const [expanded, setExpanded] = useState(false);

  if (invoices.length === 0) {
    return <Text style={styles.empty}>Nenhuma cobrança ainda</Text>;
  }

  const visible = expanded ? invoices : invoices.slice(0, COLLAPSED_COUNT);
  const canExpand = !expanded && invoices.length > COLLAPSED_COUNT;

  return (
    <View style={styles.wrapper}>
      <View style={styles.list}>
        {visible.map((invoice, index) => {
          const paid = invoice.status === 'paid';
          return (
            <View key={invoice.id}>
              {index > 0 ? <View style={styles.separator} /> : null}
              <View style={styles.row} testID={`invoice-${invoice.id}`}>
                <View style={styles.texts}>
                  <Text style={styles.date}>{formatSubscriptionDate(invoice.createdAt)}</Text>
                  <Text style={styles.amount}>{formatBRL(invoice.amountCents)}</Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: paid ? colors.surfaceSuccess : colors.accent },
                  ]}
                >
                  <Text style={styles.badgeText}>{paid ? 'Pago' : 'Pendente'}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      {canExpand ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded(true)}
          style={styles.expand}
        >
          <Text style={styles.expandText}>Ver todas as faturas</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 24,
  },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    borderRadius: 16,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: colors.surfaceGrey,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  texts: {
    flex: 1,
    gap: 4,
  },
  date: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  amount: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 24,
  },
  badgeText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.surface,
  },
  expand: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expandText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  empty: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default SubscriptionInvoiceList;
