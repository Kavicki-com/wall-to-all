import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { IconClose } from '../../lib/icons';
import { colors } from '../../lib/theme';

/**
 * Item do menu do drawer. `route` navega via expo-router; `onPress` tem
 * precedência sobre `route` quando ambos estão presentes. `icon` e `badge`
 * são opcionais (o design atual renderiza apenas o rótulo).
 */
export interface DrawerItem {
  label: string;
  icon?: React.ReactNode;
  route?: string;
  onPress?: () => void;
  badge?: string | number;
}

export interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  items: DrawerItem[];
  /** Conteúdo opcional renderizado acima da lista de itens (ex.: saudação). */
  header?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Figma nodes 2643:8225 (cliente) e 2567:4975 (lojista) — mesmo componente,
// apenas os itens do menu mudam. Painel branco encostado à direita.
const H_PADDING = 16; // Figma padding/m — recuo horizontal do painel.
const V_PADDING = 32; // Figma padding/xl — recuo vertical do painel.
const CONTENT_WIDTH = 254; // Largura do container de itens (alinhado à direita).
const GAP = 24; // Figma gap/l — entre o X, o header e os itens.
const ICON_SIZE = 24; // Ícone de fechar (24×24).
const ITEM_PADDING = 4; // Figma padding/xs — recuo interno de cada item.
const ITEM_RADIUS = 4; // Figma border/radius/s — canto de cada item.
const ITEM_GAP = 8; // Espaçamento entre ícone, rótulo e badge dentro do item.
const LABEL_SIZE = 16; // Montserrat Bold 16px — rótulo do item.

// Alarga o alvo de toque do X para ~44×44 (mínimo de acessibilidade), igual à TopBar.
const CLOSE_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export const AppDrawer: React.FC<AppDrawerProps> = ({
  visible,
  onClose,
  items,
  header,
  style,
  testID,
}) => {
  const router = useRouter();

  const handleItemPress = (item: DrawerItem) => {
    // Age primeiro (callback tem precedência sobre a rota), depois fecha.
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Backdrop translúcido que ocupa a tela inteira e fecha ao toque. */}
        <Pressable
          testID="drawer-overlay"
          accessibilityLabel="Fechar menu"
          style={styles.overlay}
          onPress={onClose}
        />

        {/* Painel branco encostado à direita. */}
        <View testID={testID} style={[styles.panel, style]}>
          <Pressable
            testID="drawer-close"
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={CLOSE_HIT_SLOP}
            onPress={onClose}
          >
            <IconClose size={ICON_SIZE} color={colors.brand} />
          </Pressable>

          {header ? <View style={styles.header}>{header}</View> : null}

          <View style={styles.items}>
            {items.map((item, index) => (
              <Pressable
                key={`${item.label}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handleItemPress(item)}
                style={styles.item}
              >
                {item.icon ? <View style={styles.itemIcon}>{item.icon}</View> : null}
                <Text style={styles.itemLabel}>{item.label}</Text>
                {item.badge != null ? <Text style={styles.itemBadge}>{item.badge}</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end', // Painel encostado à direita.
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay, // rgba(0,0,0,0.5)
  },
  panel: {
    height: '100%',
    backgroundColor: colors.surface, // Figma surface/standard === colors.surface
    paddingHorizontal: H_PADDING,
    paddingVertical: V_PADDING,
    alignItems: 'flex-end', // Conteúdo alinhado à direita.
    gap: GAP,
  },
  header: {
    width: CONTENT_WIDTH,
  },
  items: {
    width: CONTENT_WIDTH,
    gap: GAP,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ITEM_GAP,
    padding: ITEM_PADDING,
    borderRadius: ITEM_RADIUS,
  },
  itemIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: LABEL_SIZE,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand, // Figma content/primary === colors.brand
  },
  itemBadge: {
    fontSize: LABEL_SIZE,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
});
