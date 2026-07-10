import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { IconRadioFill, IconRadioNoFill } from '../../lib/icons';
import { colors } from '../../lib/theme';
import { CardBrandFlag } from './CardBrandFlag';
import type { PaymentCard } from '../../lib/services/types';

export interface PaymentCardRowProps {
  card: PaymentCard;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Linha selecionável para escolher um cartão salvo. Reutilizada pelo
// bottom-sheet de pagamento (Task 17) e pela carteira (F5) — genérica.
const FLAG_SIZE = 28;
const RADIO_SIZE = 24;
// Alarga o alvo de toque da linha para conforto (≥44 de altura já vem do padding).
const ROW_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export const PaymentCardRow: React.FC<PaymentCardRowProps> = ({
  card,
  selected = false,
  onPress,
  style,
  testID,
}) => {
  const maskedNumber = `•••• ${card.last4}`;
  const RadioIcon = selected ? IconRadioFill : IconRadioNoFill;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Cartão ${card.brand} terminado em ${card.last4}`}
      onPress={onPress}
      hitSlop={ROW_HIT_SLOP}
      testID={testID}
      style={[styles.row, style]}
    >
      <RadioIcon size={RADIO_SIZE} color={selected ? colors.brand : colors.textSecondary} />
      <CardBrandFlag brand={card.brand} size={FLAG_SIZE} />
      <View style={styles.texts}>
        <Text style={styles.number} numberOfLines={1}>
          {maskedNumber}
        </Text>
        <Text style={styles.holder} numberOfLines={1}>
          {card.holderName}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  texts: {
    flex: 1,
  },
  number: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
  },
  holder: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
});
