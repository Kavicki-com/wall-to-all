import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { colors } from '../../lib/theme';
import type { CardBrand } from '../../lib/services/types';

export interface CardBrandFlagProps {
  brand: CardBrand;
  /** Largura de referência do selo (px). Altura é derivada. */
  size?: number;
}

// Figma node 2655:21161 — selo da bandeira do cartão.
const DEFAULT_SIZE = 32;

// Cores de MARCA registradas dos emissores (identidade externa, NÃO tokens do
// app). Ficam locais a este componente de propósito: representam logotipos de
// terceiros, não a paleta do design system. Ver regra de tokens da Task 12.
const MASTERCARD_RED = '#EB001B';
const MASTERCARD_AMBER = '#F79E1B';
const VISA_BLUE = '#1A1F71';

export const CardBrandFlag: React.FC<CardBrandFlagProps> = ({ brand, size = DEFAULT_SIZE }) => {
  const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
  const rootProps = {
    testID: `card-brand-${brand}`,
    accessibilityLabel: `Bandeira ${brandName}`,
    accessibilityRole: 'image' as const,
  };

  if (brand === 'mastercard') {
    const height = size * 0.75;
    return (
      <View {...rootProps} style={{ width: size, height }}>
        {/* Dois círculos sobrepostos (24 de diâmetro) num viewBox 32×24. */}
        <Svg width={size} height={height} viewBox="0 0 32 24">
          <Circle cx={12} cy={12} r={12} fill={MASTERCARD_RED} />
          <Circle cx={20} cy={12} r={12} fill={MASTERCARD_AMBER} opacity={0.85} />
        </Svg>
      </View>
    );
  }

  if (brand === 'visa') {
    return (
      <View {...rootProps}>
        <Text style={[styles.visa, { fontSize: size * 0.5 }]} allowFontScaling={false}>
          VISA
        </Text>
      </View>
    );
  }

  // elo / amex — selo textual (fallback aceitável para bandeiras sem logo próprio).
  return (
    <View {...rootProps} style={styles.badge}>
      <Text style={[styles.badgeText, { fontSize: size * 0.4 }]} allowFontScaling={false}>
        {brand.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  visa: {
    fontFamily: 'Montserrat_700Bold',
    fontStyle: 'italic',
    letterSpacing: 1,
    color: VISA_BLUE,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.contentLightGrey,
    backgroundColor: colors.background,
  },
  badgeText: {
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: 1,
    color: colors.brand,
  },
});
