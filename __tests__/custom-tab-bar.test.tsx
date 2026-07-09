import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CustomTabBar } from '../components/CustomTabBar';
import { MerchantCustomTabBar } from '../components/MerchantCustomTabBar';

// Estas tab bars leem a área segura; forçamos insets zerados para que a
// renderização em jest seja determinística (mesmo padrão do top-bar.test.tsx).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Constrói um BottomTabBarProps mínimo à mão: state com routes + index,
// descriptors indexados por route.key com um objeto options (usamos o nome da
// rota como accessibilityLabel para localizar cada item), e navigation com
// emit/navigate como jest.fn.
function buildTabBarProps(routeNames: string[], activeIndex: number): BottomTabBarProps {
  const routes = routeNames.map((name) => ({ key: `${name}-key`, name }));

  const descriptors = routes.reduce<
    Record<string, { options: { tabBarAccessibilityLabel: string } }>
  >((acc, route) => {
    acc[route.key] = { options: { tabBarAccessibilityLabel: route.name } };
    return acc;
  }, {});

  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };

  return {
    state: { index: activeIndex, routes },
    descriptors,
    navigation,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
}

describe('CustomTabBar (cliente)', () => {
  const clientRoutes = ['home/index', 'appointments/index', 'profile/index', 'settings/index'];

  it('renders exactly one button per visible route (ignoring non-tab routes)', () => {
    // Adiciona uma rota que não é tab para garantir que a filtragem a remove.
    render(<CustomTabBar {...buildTabBarProps([...clientRoutes, 'notifications/index'], 0)} />);
    expect(screen.getAllByRole('button')).toHaveLength(clientRoutes.length);
  });

  it('marks the button at the active index as selected and others as not selected', () => {
    const activeIndex = 1; // appointments/index
    render(<CustomTabBar {...buildTabBarProps(clientRoutes, activeIndex)} />);

    const active = screen.getByLabelText(clientRoutes[activeIndex]);
    expect(active.props.accessibilityState.selected).toBe(true);

    const inactive = screen.getByLabelText(clientRoutes[0]);
    expect(inactive.props.accessibilityState.selected).toBeFalsy();
  });
});

describe('MerchantCustomTabBar (lojista)', () => {
  const merchantRoutes = [
    'home/index',
    'dashboard/index',
    'services/index',
    'profile/index',
    'settings/index',
  ];

  it('renders exactly one button per visible route (ignoring non-tab routes)', () => {
    render(
      <MerchantCustomTabBar {...buildTabBarProps([...merchantRoutes, 'notifications/index'], 0)} />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(merchantRoutes.length);
  });

  it('marks the button at the active index as selected and others as not selected', () => {
    const activeIndex = 2; // services/index
    render(<MerchantCustomTabBar {...buildTabBarProps(merchantRoutes, activeIndex)} />);

    const active = screen.getByLabelText(merchantRoutes[activeIndex]);
    expect(active.props.accessibilityState.selected).toBe(true);

    const inactive = screen.getByLabelText(merchantRoutes[0]);
    expect(inactive.props.accessibilityState.selected).toBeFalsy();
  });
});
