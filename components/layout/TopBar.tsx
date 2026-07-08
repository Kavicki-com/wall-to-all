import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { IconBack } from '../../lib/icons';
import { colors } from '../../lib/theme';

export interface TopBarProps {
  title?: string;
  onBack?: () => void;
  rightActions?: React.ReactNode;
  variant?: 'light' | 'brand';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Figma node 2715:3617 — top app bar.
const BAR_HEIGHT = 56; // Altura da barra.
const H_PADDING = 24; // Figma padding/l — recuo horizontal.
const GAP = 8; // Figma gap/s — espaçamento entre slots.
const ICON_SIZE = 24; // Tamanho do ícone (24×24).

// Alarga o alvo de toque do botão voltar para ~44×44 (mínimo de acessibilidade).
const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onBack,
  rightActions,
  variant = 'brand',
  style,
  testID,
}) => {
  // Conteúdo claro sobre a marca (navy); conteúdo navy sobre o fundo claro.
  const foreground = variant === 'brand' ? colors.contentLight : colors.brand;

  return (
    <View
      testID={testID}
      style={[styles.container, variant === 'brand' ? styles.brand : styles.light, style]}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          testID="topbar-back"
          hitSlop={BACK_HIT_SLOP}
          onPress={onBack}
        >
          <IconBack size={ICON_SIZE} color={foreground} />
        </Pressable>
      ) : null}

      {title ? (
        <Text style={[styles.title, { color: foreground }]} numberOfLines={1}>
          {title}
        </Text>
      ) : null}

      {rightActions ? <View style={styles.rightActions}>{rightActions}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PADDING,
    gap: GAP,
  },
  brand: {
    backgroundColor: colors.brand, // Figma surface/primary === colors.brand
  },
  light: {
    backgroundColor: colors.surfacePrimaryExtraLight, // Figma surface/primary-extra-light
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
  },
  rightActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
});
