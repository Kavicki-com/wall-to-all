import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, IconFamily } from './ui/Icon';
import { colors } from '../lib/theme';

type TabBarProps = BottomTabBarProps;

interface TabItem {
  route: string;
  iconName: string;
  family: IconFamily;
  iconSize: number;
}

const tabs: TabItem[] = [
  { route: 'home/index', iconName: 'search', family: 'MaterialSymbols', iconSize: 24 },
  {
    route: 'appointments/index',
    iconName: 'calendar_clock',
    family: 'MaterialSymbols',
    iconSize: 24,
  },
  {
    route: 'profile/index',
    iconName: 'account-circle-outline',
    family: 'MaterialCommunityIcons',
    iconSize: 24,
  },
  { route: 'settings/index', iconName: 'settings', family: 'MaterialSymbols', iconSize: 24 },
];

export const CustomTabBar: React.FC<TabBarProps> = (props) => {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 72;

  const focusedTab = state.routes[state.index];
  const nestedState = focusedTab.state as
    | { routes?: { name: string }[]; index?: number }
    | undefined;
  const nestedRouteName = nestedState?.routes?.[nestedState.index ?? 0]?.name ?? focusedTab.name;

  const hiddenScreens = ['search/index', 'home/share', 'store/[id]'];

  if (hiddenScreens.includes(nestedRouteName)) {
    return null;
  }

  const visibleRoutes = state.routes.filter((route) => {
    return tabs.some((t) => t.route === route.name);
  });

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          height: TAB_BAR_HEIGHT + (insets.bottom > 0 ? insets.bottom : 10),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        },
      ]}
    >
      {visibleRoutes.map((route) => {
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const { options } = descriptors[route.key];
        const isScheduleRoute = nestedRouteName?.startsWith('schedule/');
        const isAppointmentsTab = route.name === 'appointments/index';
        const isFocused = isScheduleRoute && isAppointmentsTab ? true : state.index === routeIndex;
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

        const iconColor = isFocused ? colors.brand : colors.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={styles.tabButton}
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
    backgroundColor: colors.surface,
    alignItems: 'stretch',
    justifyContent: 'space-between',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
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
  },
  tabIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
