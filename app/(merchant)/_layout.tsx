import React from 'react';
import { Tabs } from 'expo-router';
import { MerchantCustomTabBar } from '../../components/MerchantCustomTabBar';

const MerchantLayout: React.FC = () => {
  return (
    <Tabs
      tabBar={(props) => <MerchantCustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      {/* ========================================
          TABS VISÍVEIS (5 ícones conforme Figma)
          ======================================== */}
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Início',
          tabBarAccessibilityLabel: 'Início',
        }}
      />
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: 'Agenda',
          tabBarAccessibilityLabel: 'Ver agenda',
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: 'Serviços',
          tabBarAccessibilityLabel: 'Gerenciar serviços',
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
          tabBarAccessibilityLabel: 'Configurações',
        }}
      />
      
      {/* ========================================
          ROTAS OCULTAS (não aparecem na TabBar)
          ======================================== */}
      <Tabs.Screen
        name="dashboard/appointment/[id]"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="dashboard/month"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="services/create"
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="services/edit/[id]"
        options={{
          tabBarButton: () => null,
        }}
      />
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

export default MerchantLayout;

