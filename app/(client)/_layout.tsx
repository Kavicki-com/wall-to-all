import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../components/CustomTabBar';

const ClientLayout: React.FC = () => {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      {/* ========================================
          TABS VISÍVEIS (4 ícones conforme Figma)
          ======================================== */}
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Busca',
          tabBarAccessibilityLabel: 'Buscar serviços',
        }}
      />
      <Tabs.Screen
        name="appointments/index"
        options={{
          title: 'Agendamentos',
          tabBarAccessibilityLabel: 'Ver agendamentos',
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Ver perfil',
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Configurações',
          tabBarAccessibilityLabel: 'Configurações do app',
        }}
      />
      
      {/* ========================================
          ROTAS OCULTAS (não aparecem na TabBar)
          ======================================== */}
      
      {/* Schedule - Fluxo de agendamento */}
      <Tabs.Screen
        name="schedule/service"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="schedule/date"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="schedule/time"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="schedule/confirm"
        options={{
          tabBarButton: () => null,
        }}
      />
      
      {/* Store - Detalhes da loja */}
      <Tabs.Screen
        name="store/[id]"
        options={{
          tabBarButton: () => null,
        }}
      />
      
      {/* Services - Lista de serviços */}
      <Tabs.Screen
        name="services/index"
        options={{
          tabBarButton: () => null,
        }}
      />
      
      {/* Search - Busca de serviços */}
      <Tabs.Screen
        name="search/index"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="search/results"
        options={{
          tabBarButton: () => null,
        }}
      />
      
      {/* Profile - Subrotas */}
      <Tabs.Screen
        name="profile/edit"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="profile/password"
        options={{
          tabBarButton: () => null,
        }}
      />
      
      {/* Settings - Subrotas */}
      <Tabs.Screen
        name="settings/faq"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="settings/terms"
        options={{
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
};

export default ClientLayout;
