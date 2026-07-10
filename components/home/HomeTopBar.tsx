import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconMenu, IconNotification } from '../../lib/icons';
import { colors } from '../../lib/theme';

export interface HomeTopBarProps {
  /** Toque no hambúrguer (à esquerda) — normalmente abre o AppDrawer. */
  onMenu: () => void;
  /** Toque no sino (à direita). Quando ausente, o sino não é renderizado. */
  onBell?: () => void;
  /** Contagem de notificações não lidas; > 0 exibe o badge vermelho. */
  notificationCount?: number;
  testID?: string;
}

// Alarga o alvo de toque dos ícones para ~48×48 (mínimo de acessibilidade),
// igual à TopBar/AppDrawer.
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * Top bar navy compartilhada das HOMES (cliente — F2 Task 4; lojista — Task 7).
 * Genérica de propósito: só recebe callbacks (`onMenu`/`onBell`) e a contagem de
 * notificações; não conhece drawer, rotas nem o fluxo de notificações — quem a
 * usa é dono desses estados.
 *
 * Layout (Figma node 2715:3573 "Top bar"): faixa clara fina
 * (`surfacePrimaryExtraLight`) sobre a status bar + barra navy com o hambúrguer à
 * esquerda e o sino à direita.
 *
 * NOTA DE DESIGN: o Figma pinta a barra com um gradiente radial sutil. Aqui
 * usamos navy chapado + a faixa divisória clara — igual às top bars já
 * embarcadas do "Aqui e Agora" (consistência entre telas > o gradiente pixel a
 * pixel). Mesma decisão tomada na top bar do aqui-agora do lojista.
 */
export const HomeTopBar: React.FC<HomeTopBarProps> = ({
  onMenu,
  onBell,
  notificationCount = 0,
  testID,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.topBar} testID={testID}>
      {/* Faixa clara sobre a status bar (o "Divider" do Figma). */}
      <View style={[styles.topBarInset, { height: insets.top }]} />
      <View style={styles.topBarContent}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir menu"
          testID="topbar-menu"
          hitSlop={HIT_SLOP}
          onPress={onMenu}
        >
          <IconMenu size={24} color={colors.contentLight} />
        </Pressable>

        {onBell ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            testID="topbar-bell"
            hitSlop={HIT_SLOP}
            onPress={onBell}
          >
            <View style={styles.bellWrapper}>
              <IconNotification size={24} color={colors.contentLight} />
              {notificationCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: colors.brand,
  },
  topBarInset: {
    backgroundColor: colors.surfacePrimaryExtraLight, // faixa clara sobre a status bar
  },
  topBarContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  bellWrapper: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: colors.contentLight,
    textAlign: 'center',
  },
});

export default HomeTopBar;
