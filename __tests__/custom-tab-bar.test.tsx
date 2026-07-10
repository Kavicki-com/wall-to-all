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

// Rota mínima do state de um tab navigator. `state` opcional permite simular
// uma rota focada com estado aninhado (usado para o cálculo de nestedRouteName).
type TestRoute = { key: string; name: string; state?: unknown };

function makeRoute(name: string, state?: unknown): TestRoute {
  return state === undefined ? { key: `${name}-key`, name } : { key: `${name}-key`, name, state };
}

// Constrói um BottomTabBarProps mínimo à mão a partir de rotas já montadas:
// descriptors indexados por route.key com um objeto options (usamos o nome da
// rota como accessibilityLabel para localizar cada item), e navigation com
// emit/navigate como jest.fn.
function buildPropsFromRoutes(routes: TestRoute[], activeIndex: number): BottomTabBarProps {
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

function buildTabBarProps(routeNames: string[], activeIndex: number): BottomTabBarProps {
  return buildPropsFromRoutes(
    routeNames.map((name) => makeRoute(name)),
    activeIndex,
  );
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

  it('renders nothing when the focused route resolves to a hidden screen', () => {
    // A aba focada (home) carrega um estado aninhado apontando para a rota oculta
    // 'search/index'; nestedRouteName resolve para ela e a barra some por completo.
    const routes = [
      makeRoute('home/index', { index: 0, routes: [{ name: 'search/index' }] }),
      ...clientRoutes.slice(1).map((name) => makeRoute(name)),
    ];
    const { toJSON } = render(<CustomTabBar {...buildPropsFromRoutes(routes, 0)} />);
    expect(toJSON()).toBeNull();
  });

  it('keeps the appointments tab selected while a hidden schedule/* route is focused', () => {
    // schedule/* são rotas-irmãs ocultas (ver app/(client)/_layout.tsx). Quando uma
    // delas está focada, state.index NÃO aponta para appointments, então só o ramo
    // isScheduleRoute && isAppointmentsTab mantém a aba de agendamentos ativa.
    const routes = [...clientRoutes, 'schedule/time'].map((name) => makeRoute(name));
    const scheduleIndex = routes.length - 1;
    render(<CustomTabBar {...buildPropsFromRoutes(routes, scheduleIndex)} />);

    const appointments = screen.getByLabelText('appointments/index');
    expect(appointments.props.accessibilityState.selected).toBe(true);

    const home = screen.getByLabelText('home/index');
    expect(home.props.accessibilityState.selected).toBeFalsy();
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

  it('renders the buttons in the tabs-defined order regardless of the routes order', () => {
    // Ordem embaralhada (diferente da ordem de `tabs`) para exercitar o .sort().
    const scrambled = [
      'settings/index',
      'home/index',
      'profile/index',
      'dashboard/index',
      'services/index',
    ];
    render(<MerchantCustomTabBar {...buildTabBarProps(scrambled, 0)} />);

    const renderedOrder = screen.getAllByRole('button').map((btn) => btn.props.accessibilityLabel);
    expect(renderedOrder).toEqual(merchantRoutes);
    // Sanidade: a entrada estava mesmo fora de ordem, então o sort reordenou.
    expect(renderedOrder).not.toEqual(scrambled);
  });
});
