import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../lib/theme';
import { CardBrandFlag } from './CardBrandFlag';
import type { PaymentCard } from '../../lib/services/types';

export interface CreditCardProps {
  card: PaymentCard;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Figma node 2643:8859 — visual grande do cartão.
const CARD_HEIGHT = 194;
const CARD_RADIUS = 24;
const CARD_PADDING = 24;
const MASK_GROUP = '••••';

export const CreditCard: React.FC<CreditCardProps> = ({ card, style, testID }) => {
  // Número mascarado: só os últimos 4 dígitos reais são conhecidos.
  const maskedNumber = `${MASK_GROUP} ${MASK_GROUP} ${MASK_GROUP} ${card.last4}`;

  return (
    <View testID={testID} style={[styles.card, style]}>
      <Text style={styles.holder} numberOfLines={1}>
        {card.holderName}
      </Text>
      <View style={styles.bottomRow}>
        <Text style={styles.number} numberOfLines={1} allowFontScaling={false}>
          {maskedNumber}
        </Text>
        <CardBrandFlag brand={card.brand} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    justifyContent: 'flex-end',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.contentLightGrey,
    gap: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holder: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  number: {
    // Ocupa o espaço restante do row space-between e encolhe/elipsa antes de
    // empurrar a bandeira (defensivo contra last4 malformado/longo).
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
});
