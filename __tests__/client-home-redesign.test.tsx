/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
/**
 * Testes de comportamento da home do cliente redesenhada (F2 — Dashboards/Home,
 * Task 4) e da HomeTopBar compartilhada.
 *
 * A home é Supabase-backed: mockamos `lib/supabase` no escopo do módulo (auth +
 * um query-builder encadeável que resolve dados por tabela via `mockTableData`),
 * `expo-router` (useRouter → mockPush), `react-native-safe-area-context`
 * (useSafeAreaInsets + SafeAreaView usados pelo ScreenContainer/HomeTopBar), o
 * NotificationContext (contagem/refresh) e o NotificationModal (stub leve). Os
 * testes asseguram: render das seções após o load, estado vazio de agendamentos,
 * abertura do drawer pelo menu e navegação do combo de busca.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ScreenContainer usa SafeAreaView; HomeTopBar usa useSafeAreaInsets. Inset
// determinístico (mesma abordagem das demais telas).
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

// Dados por tabela do Supabase, reconfigurados a cada teste. Prefixo `mock`
// exigido pelo hoisting do Jest; lido preguiçosamente pelo query-builder.
const mockGetUser = jest.fn();
const mockTableData: Record<string, unknown[]> = {};

jest.mock('../lib/supabase', () => {
  const chainMethods = ['select', 'eq', 'order', 'gte', 'lte', 'limit', 'range', 'in'];
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of chainMethods) {
      builder[method] = () => builder;
    }
    // Thenable: resolve com os dados configurados para a tabela.
    builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: (mockTableData[table] as unknown[]) ?? [], error: null });
    return builder;
  };
  return {
    supabase: {
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => buildQuery(table),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => undefined,
    },
  };
});

const mockRefreshNotifications = jest.fn();
jest.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ unreadCount: 0, refreshNotifications: mockRefreshNotifications }),
}));

// Stub leve do NotificationModal: expõe apenas se está visível (evita puxar
// AuthContext, useSegments, fetchNotifications, date-fns).
jest.mock('../components/notifications/NotificationModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) =>
      visible ? React.createElement(View, { testID: 'notif-modal' }) : null,
  };
});

jest.mock('../lib/cache', () => ({
  Cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import ClientHomeScreen from '../app/(client)/home/index';
import { HomeTopBar } from '../components/home/HomeTopBar';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const todayIso = new Date().toISOString();

function seedFixtures() {
  mockTableData.appointments = [
    {
      id: 1,
      start_time: todayIso,
      end_time: todayIso,
      status: 'confirmed',
      payment_method: 'pix',
      service: { id: 10, name: 'Corte masculino' },
      business: { business_name: 'Hothog Barber Shop', logo_url: null },
    },
  ];
  mockTableData.business_profiles = [
    {
      id: 1,
      business_name: 'Hothog Barber Shop',
      logo_url: 'https://example.com/logo1.png',
      banner_url: 'https://example.com/banner1.png',
      description: 'Cortes masculinos e femininos',
      address: 'Rua A, 100',
      accepted_payment_methods: { pix: true, card: true },
      work_days: { monday: { start: '10:00', end: '18:00' } },
      services: [{ id: 10, name: 'Corte masculino', price: 65 }],
      categories: { id: 1, name: 'Barbeiro' },
    },
    {
      id: 2,
      business_name: 'Serenity Massage',
      logo_url: null,
      banner_url: null,
      description: 'Massagem e terapias relaxantes',
      address: null,
      accepted_payment_methods: null,
      work_days: null,
      services: [],
      categories: null,
    },
  ];
  mockTableData.services = [
    {
      id: 10,
      name: 'Corte de cabelo Masculino',
      price: 65,
      photos: null,
      is_active: true,
      business_id: 1,
      categories: { id: 1, name: 'Barbeiro' },
      business_profiles: { business_name: 'Hothog Barber Shop' },
    },
    {
      id: 11,
      name: 'Massagem relaxante',
      price: 120,
      photos: null,
      is_active: true,
      business_id: 2,
      categories: { id: 2, name: 'Massagista' },
      business_profiles: { business_name: 'Serenity Massage' },
    },
  ];
  mockTableData.categories = [
    { id: 1, name: 'Barbeiro' },
    { id: 2, name: 'Manicure' },
    { id: 3, name: 'Encanador' },
  ];
  mockTableData.reviews = [];
  mockTableData.appointment_reschedules = [];
}

// ── HomeTopBar (componente compartilhado) ───────────────────────────────────

describe('HomeTopBar', () => {
  it('dispara onMenu ao pressionar o hambúrguer', () => {
    const onMenu = jest.fn();
    const { getByTestId } = render(<HomeTopBar onMenu={onMenu} />);

    fireEvent.press(getByTestId('topbar-menu'));

    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('só renderiza o sino quando onBell é fornecido e o dispara ao toque', () => {
    const onBell = jest.fn();
    const { getByTestId, queryByTestId, rerender } = render(<HomeTopBar onMenu={jest.fn()} />);

    // Sem onBell → sem sino.
    expect(queryByTestId('topbar-bell')).toBeNull();

    rerender(<HomeTopBar onMenu={jest.fn()} onBell={onBell} />);
    fireEvent.press(getByTestId('topbar-bell'));

    expect(onBell).toHaveBeenCalledTimes(1);
  });

  it('exibe o badge com a contagem quando notificationCount > 0 e o oculta quando 0', () => {
    const { getByText, queryByText, rerender } = render(
      <HomeTopBar onMenu={jest.fn()} onBell={jest.fn()} notificationCount={3} />,
    );

    expect(getByText('3')).toBeTruthy();

    rerender(<HomeTopBar onMenu={jest.fn()} onBell={jest.fn()} notificationCount={0} />);
    expect(queryByText('0')).toBeNull();
  });
});

// ── Home do cliente (redesign) ───────────────────────────────────────────────

describe('ClientHomeScreen (redesign)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedFixtures();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('após o load, renderiza "Lojas em destaque" com os cards e um item de stories', async () => {
    render(<ClientHomeScreen />);

    // Título da seção (aparece após o load terminar).
    expect(await screen.findByText('Lojas em destaque')).toBeTruthy();
    // Os dois negócios em destaque viram StoreHighlightCards.
    expect(screen.getAllByTestId('store-highlight-card')).toHaveLength(2);
    // E ao menos um nome de negócio aparece nos cards.
    expect(screen.getAllByText('Hothog Barber Shop').length).toBeGreaterThan(0);
    // A StoriesRow renderiza um anel por loja em destaque.
    expect(screen.getByTestId('story-1')).toBeTruthy();
  });

  it('navega para a loja ao tocar num card de destaque', async () => {
    render(<ClientHomeScreen />);
    await screen.findByText('Lojas em destaque');

    // O primeiro card em destaque é o business_profile id 1 (Hothog Barber Shop).
    fireEvent.press(screen.getAllByTestId('store-highlight-card')[0]);
    expect(mockPush).toHaveBeenCalledWith('/(client)/store/1');
  });

  it('mostra o "Preço médio" do card de destaque a partir do preço real do serviço', async () => {
    render(<ClientHomeScreen />);
    await screen.findByText('Lojas em destaque');

    // Fixture id 1 tem um serviço de R$ 65 → priceTier([65]) === 2 → dois "$"
    // acesos. Confirma que o preço chega ao card (o select traz services.price).
    const lit = screen.getAllByTestId('price-lit');
    expect(lit.length).toBeGreaterThan(0);
    expect(lit[0].props.children).toBe('$$');
  });

  it('mostra o cartão tracejado de estado vazio quando não há agendamentos', async () => {
    mockTableData.appointments = [];
    render(<ClientHomeScreen />);

    expect(
      await screen.findByText(/Você ainda não tem nenhum agendamento/),
    ).toBeTruthy();
  });

  it('abre o drawer ao pressionar o menu (um item como "Perfil" fica visível)', async () => {
    render(<ClientHomeScreen />);
    await screen.findByText('Lojas em destaque');

    // Drawer fechado: o item não está visível.
    expect(screen.queryByText('Perfil')).toBeNull();

    fireEvent.press(screen.getByTestId('topbar-menu'));

    expect(await screen.findByText('Perfil')).toBeTruthy();
  });

  it('navega para a busca ao pressionar o combo de busca', async () => {
    render(<ClientHomeScreen />);
    await screen.findByText('Lojas em destaque');

    fireEvent.press(screen.getByTestId('home-search-combo'));

    expect(mockPush).toHaveBeenCalledWith('/(client)/search');
  });

  it('abre o modal de notificações ao pressionar o sino', async () => {
    render(<ClientHomeScreen />);
    await screen.findByText('Lojas em destaque');

    expect(screen.queryByTestId('notif-modal')).toBeNull();

    fireEvent.press(screen.getByTestId('topbar-bell'));

    expect(screen.getByTestId('notif-modal')).toBeTruthy();
  });
});
