import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, IconFamily } from './ui/Icon'; 

type TabBarProps = BottomTabBarProps;

interface TabItem {
  route: string;
  iconName: string;
  family: IconFamily; // Agora definimos a família explicitamente
  iconSize: number;
}

const tabs: TabItem[] = [
  { route: 'home/index', iconName: 'home', family: 'MaterialSymbols', iconSize: 28 },
  { route: 'dashboard/index', iconName: 'calendar-clock', family: 'MaterialCommunityIcons', iconSize: 26 },
  { route: 'services/index', iconName: 'business_center', family: 'MaterialSymbols', iconSize: 26 },
  { route: 'profile/index', iconName: 'account-circle-outline', family: 'MaterialCommunityIcons', iconSize: 28 },
  { route: 'settings/index', iconName: 'settings', family: 'MaterialSymbols', iconSize: 28 },
];

export const MerchantCustomTabBar: React.FC<TabBarProps> = (props) => {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  
  const focusedTab = state.routes[state.index];
  const nestedState = focusedTab.state as { routes?: Array<{ name: string }>; index?: number } | undefined;
  const nestedRouteName =
    nestedState?.routes?.[nestedState.index ?? 0]?.name ?? focusedTab.name;
  
  const hiddenScreens: string[] = [];
  
  if (hiddenScreens.includes(nestedRouteName)) {
    return null;
  }
  
  const visibleRoutes = state.routes
    .filter((route) => tabs.some((t) => t.route === route.name))
    .sort((a, b) => {
      const indexA = tabs.findIndex(t => t.route === a.name);
      const indexB = tabs.findIndex(t => t.route === b.name);
      return indexA - indexB;
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
              isFocused && styles.tabButtonActive,
            ]}
            activeOpacity={0.8}
          >
            <View style={styles.tabIconWrapper}>
              <Icon 
                name={tabItem.iconName} 
                family={tabItem.family}
                size={tabItem.iconSize} 
                color={iconColor} 
              />
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
    paddingHorizontal: 16,
    backgroundColor: '#FEFEFE',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 2,
  },
  tabButtonActive: {
    height: 52, // Ajuste fino para o box vermelho ficar igual ao Figma
    backgroundColor: '#E5102E',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  tabIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});