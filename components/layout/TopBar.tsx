import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconBack } from '../../lib/icons';
import { colors } from '../../lib/theme';

export interface TopBarProps {
  title?: string;
  onBack?: () => void;
  /** Rótulo de acessibilidade do botão voltar (padrão: 'Voltar'). */
  backAccessibilityLabel?: string;
  rightActions?: React.ReactNode;
  /**
   * Cor de fundo/primeiro plano da barra. O conteúdo passado em `rightActions`
   * deve combinar com o primeiro plano da variante (contentLight na `brand`,
   * brand na `light`), pois o slot renderiza nós arbitrários.
   */
  variant?: 'light' | 'brand';
  /**
   * Aplica o inset superior da área segura (status bar/notch) ao container,
   * mantendo os 56px de conteúdo abaixo dela. Desative em headers modais.
   */
  insetTop?: boolean;
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
  backAccessibilityLabel = 'Voltar',
  rightActions,
  variant = 'brand',
  insetTop = true,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  // Conteúdo claro sobre a marca (navy); conteúdo navy sobre o fundo claro.
  const foreground = variant === 'brand' ? colors.contentLight : colors.brand;

  return (
    // O container carrega o fundo e o inset superior; a linha de conteúdo mantém
    // os 56px fixos abaixo da status bar e o fundo se estende atrás dela.
    <View
      testID={testID}
      style={[
        variant === 'brand' ? styles.brand : styles.light,
        insetTop ? { paddingTop: insets.top } : null,
        style,
      ]}
    >
      <View style={styles.content}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
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
    </View>
  );
};

const styles = StyleSheet.create({
  brand: {
    backgroundColor: colors.brand, // Figma surface/primary === colors.brand
  },
  light: {
    backgroundColor: colors.surfacePrimaryExtraLight, // Figma surface/primary-extra-light
  },
  content: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PADDING,
    gap: GAP,
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
