import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { CardBrandFlag } from '../payment/CardBrandFlag';
import type { SubscriptionCard } from '../../lib/services/subscriptionTypes';

interface SubscriptionPaymentRowProps {
  card: SubscriptionCard | null;
  onChange: () => void;
  disabled?: boolean;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Linha "Pagamento com Cartão" do Gerenciar (subscription-manage 2668:18557).
 * Mesmo visual da linha de método do agendamento (BookingConfirmCard, F5), que
 * é privada daquele componente; replicada aqui para não tocar no território da F5.
 */
const SubscriptionPaymentRow: React.FC<SubscriptionPaymentRowProps> = ({
  card,
  onChange,
  disabled = false,
}) => (
  <View style={styles.row} testID="subscription-payment-row">
    <View style={styles.info}>
      <Text style={styles.title}>Pagamento com Cartão</Text>
      {card ? (
        <View style={styles.cardLine}>
          <Text style={styles.detail}>{`•••• ${card.last4}`}</Text>
          <CardBrandFlag brand={card.brand} />
        </View>
      ) : (
        <Text style={styles.detail}>Nenhum cartão</Text>
      )}
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Alterar cartão"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      onPress={onChange}
      style={styles.action}
    >
      <Text style={styles.actionText}>Alterar</Text>
      <Icon name="chevron_right" family="MaterialSymbols" size={24} color={colors.brand} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: colors.surfacePrimaryExtraLight,
    borderRadius: 4,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
  },
  info: {
    flex: 1,
    rowGap: 4,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.textPrimary,
  },
  cardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
  },
  detail: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  actionText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});

export default SubscriptionPaymentRow;
