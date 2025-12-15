import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, IconFamily } from './ui/Icon';

// Tipo correto para TabBar do Expo Router / React Navigation
type TabBarProps = BottomTabBarProps;

interface TabItem {
  route: string;
  iconName: string;
  family: IconFamily;
  iconSize: number;
}

// Configuração das tabs para CLIENTE conforme design do Figma (node-id: 577:3622)
// Usando MaterialSymbols e MaterialCommunityIcons
const tabs: TabItem[] = [
  { route: 'home/index', iconName: 'search', family: 'MaterialSymbols', iconSize: 26 },
  { route: 'appointments/index', iconName: 'calendar_clock', family: 'MaterialSymbols', iconSize: 30 },
  { route: 'profile/index', iconName: 'account-circle-outline', family: 'MaterialCommunityIcons', iconSize: 30 },
  { route: 'settings/index', iconName: 'settings', family: 'MaterialSymbols', iconSize: 28 },
];

export const CustomTabBar: React.FC<TabBarProps> = (props) => {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  
  // Identifica a rota interna ativa dentro da aba atual
  const focusedTab = state.routes[state.index];
  const nestedState = focusedTab.state as any;
  const nestedRouteName =
    nestedState?.routes?.[nestedState.index ?? 0]?.name ?? focusedTab.name;
  // Telas que não devem mostrar a tabbar
  const hiddenScreens = ['search/index', 'home/share'];
  // Opcional: log para descobrir o nome correto da rota
  // console.log('Rota interna ativa:', nestedRouteName);
  if (hiddenScreens.includes(nestedRouteName)) {
    return null; // Não renderiza a tabbar nessa tela
  }
  
  // Filtrar apenas as rotas que devem aparecer na tabbar
  const visibleRoutes = state.routes.filter((route) => {
    return tabs.some((t) => t.route === route.name);
  });

  const safeAreaBottom = Math.max(insets.bottom, 8);
  
  return (
    <View style={[styles.tabBarContainer, { 
      paddingBottom: safeAreaBottom,
      height: 72 - 8 + safeAreaBottom // Altura total: conteúdo (72-8) + paddingBottom
    }]}>
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

        // ✅ CORREÇÃO: TODOS os ícones ativos ficam brancos com fundo vermelho
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
    paddingTop: 8,
    paddingHorizontal: 24,
    backgroundColor: '#FEFEFE',
    alignItems: 'center', // Alinhar itens no centro vertical da barra
    justifyContent: 'flex-start', // Itens lado a lado, sem espaçamento extra
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
    flex: 1, // Cada botão ocupa espaço igual (conforme Figma: flex-[1_0_0])
    height: 56, // Altura fixa para os botões (não expandir com container)
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 4, // Padding mínimo para evitar que ícones encostem nas bordas
    paddingVertical: 3, // Padding vertical mínimo
    marginTop: 2, // Deslocar ícones 2px para baixo
  },
  tabButtonActive: {
    height: 56, // Altura fixa para o botão ativo (conforme Figma: h-[72px] mas com padding)
    backgroundColor: '#E5102E',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginTop: 2, // Deslocar ícones 2px para baixo
  },
  tabIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

