import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabBarIconHome, TabBarIconSchedule, TabBarIconBusinessCenter, TabBarIconAccount, TabBarIconSettings } from '../lib/tabbar-icons';

// Tipo correto para TabBar do Expo Router / React Navigation
type TabBarProps = BottomTabBarProps;

interface TabItem {
  route: string;
  icon: React.FC<{ size?: number; color?: string }>;
  iconSize: number;
}

// Configuração das tabs conforme design do Figma para LOJISTA (node-id: 461:7788)
// ✅ Usando componentes SVG customizados que aceitam mudança de cor
const tabs: TabItem[] = [
  { route: 'home/index', icon: TabBarIconHome, iconSize: 26 },
  { route: 'dashboard/index', icon: TabBarIconSchedule, iconSize: 30 },
  { route: 'services/index', icon: TabBarIconBusinessCenter, iconSize: 28 },
  { route: 'profile/index', icon: TabBarIconAccount, iconSize: 30 },
  { route: 'settings/index', icon: TabBarIconSettings, iconSize: 28 },
];

export const MerchantCustomTabBar: React.FC<TabBarProps> = (props) => {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  
  // Filtrar apenas as rotas que devem aparecer na tabbar
  const visibleRoutes = state.routes.filter((route) => {
    return tabs.some((t) => t.route === route.name);
  });

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const { options } = descriptors[route.key];
        const isFocused = state.index === routeIndex;
        const tabItem = tabs.find((t) => t.route === route.name);

        if (!tabItem) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const Icon = tabItem.icon;
        // ✅ TODOS os ícones ativos ficam brancos com fundo vermelho (conforme Figma)
        const iconColor = isFocused ? '#FEFEFE' : '#000E3D';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={[
              styles.tabButton,
              isFocused && styles.tabButtonActive, // ✅ Qualquer tab ativa fica vermelha
            ]}
            activeOpacity={0.8}
          >
            <View style={styles.tabIconWrapper}>
              <Icon size={tabItem.iconSize} color={iconColor} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    height: 72,
    paddingTop: 8,
    paddingHorizontal: 24,
    backgroundColor: '#FEFEFE',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabButton: {
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  tabButtonActive: {
    height: 56,
    minWidth: 56,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#E5102E',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  tabIconWrapper: {
    width: 36, // ✅ Container para ícones de 28-30px
    height: 36, // ✅ Container para ícones de 28-30px
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});



