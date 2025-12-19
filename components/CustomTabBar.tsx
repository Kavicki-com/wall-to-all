import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, IconFamily } from './ui/Icon';

type TabBarProps = BottomTabBarProps;

interface TabItem {
  route: string;
  iconName: string;
  family: IconFamily;
  iconSize: number;
}

const tabs: TabItem[] = [
  { route: 'home/index', iconName: 'search', family: 'MaterialSymbols', iconSize: 26 },
  { route: 'appointments/index', iconName: 'calendar_clock', family: 'MaterialSymbols', iconSize: 30 },
  { route: 'profile/index', iconName: 'account-circle-outline', family: 'MaterialCommunityIcons', iconSize: 30 },
  { route: 'settings/index', iconName: 'settings', family: 'MaterialSymbols', iconSize: 28 },
];

export const CustomTabBar: React.FC<TabBarProps> = (props) => {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  
  const TAB_BAR_HEIGHT = 56;
  const ACTIVE_BUTTON_HEIGHT = 68;

  const focusedTab = state.routes[state.index];
  const nestedState = focusedTab.state as any;
  const nestedRouteName =
    nestedState?.routes?.[nestedState.index ?? 0]?.name ?? focusedTab.name;

  const hiddenScreens = ['search/index', 'home/share', 'store/[id]'];

  if (hiddenScreens.includes(nestedRouteName)) {
    return null;
  }
  
  const visibleRoutes = state.routes.filter((route) => {
    return tabs.some((t) => t.route === route.name);
  });

  return (
    <View style={[
      styles.tabBarContainer, 
      { 
        height: TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom : 10),
        paddingBottom: insets.bottom > 0 ? insets.bottom : 10
      }
    ]}>
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
              { height: isFocused ? ACTIVE_BUTTON_HEIGHT : TAB_BAR_HEIGHT },
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
    paddingHorizontal: 24,
    backgroundColor: '#FEFEFE',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    width: '100%',
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        zIndex: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabButton: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: '#E5102E',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 0,
  },
  tabIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});