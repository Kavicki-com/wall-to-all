/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
/**
 * Testes de comportamento da home do LOJISTA redesenhada (F2 — Dashboards/Home,
 * Task 7, node 2478:111).
 *
 * A tela é Supabase-backed: mockamos `lib/supabase` no escopo do módulo (auth +
 * um query-builder encadeável que resolve dados por tabela via `mockTableData`,
 * com suporte a `.single()` para o perfil do negócio), `expo-router` (useRouter →
 * mockPush, useFocusEffect → no-op), `react-native-safe-area-context`
 * (useSafeAreaInsets + SafeAreaView usados pelo ScreenContainer/HomeTopBar), o
 * NotificationContext (contagem/refresh) e o NotificationModal (stub leve).
 *
 * Os testes asseguram: GoalOverview após o load, os KpiCards de indicadores, a
 * lista de "Próximos agendamentos" + navegação do "Ver todos", a abertura do
 * drawer pelo menu e o render do RevenueDonut.
 *
 * Obs.: strings BRL usam espaço NÃO-quebrável (Intl.NumberFormat) — quando
 * necessário, asserções de valor casam por regex nos dígitos, não pela literal.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // useFocusEffect é no-op nos testes: o load inicial vem do useEffect de mount.
  useFocusEffect: () => {},
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
    // `.single()` → primeira linha da tabela (ou erro PGRST116 se vazia).
    builder.single = () => {
      const first = (mockTableData[table] as unknown[] | undefined)?.[0];
      return Promise.resolve(
        first ? { data: first, error: null } : { data: null, error: { code: 'PGRST116' } },
      );
    };
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

jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import MerchantHomeScreen from '../app/(merchant)/home/index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const now = new Date();
const iso = (d: Date) => d.toISOString();

// Datas relativas a "agora" para robustez independente da data de execução.
const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
const midPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0);

function seedFixtures() {
  mockTableData.business_profiles = [
    {
      id: 1,
      business_name: 'Hothog Barber Shop',
      logo_url: null,
      description: 'Cortes masculinos e femininos',
    },
  ];
  mockTableData.appointments = [
    // Agendamento FUTURO — aparece em "Próximos agendamentos".
    {
      id: 101,
      start_time: iso(inOneDay),
      end_time: iso(new Date(inOneDay.getTime() + 60 * 60 * 1000)),
      status: 'confirmed',
      client_id: 'client-1',
      service: { id: 10, name: 'Corte masculino', price: 65 },
      client: { id: 'client-1', full_name: 'Maria Oliveira' },
    },
    // Agendamento realizado neste mês — receita/contagem/novos clientes.
    {
      id: 102,
      start_time: iso(startOfCurrentMonth),
      end_time: iso(new Date(startOfCurrentMonth.getTime() + 60 * 60 * 1000)),
      status: 'completed',
      client_id: 'client-2',
      service: { id: 11, name: 'Escova', price: 90 },
      client: { id: 'client-2', full_name: 'Carlos Silveira' },
    },
    // Agendamento do mês anterior — meta (previousRevenue) do GoalOverview.
    {
      id: 103,
      start_time: iso(midPreviousMonth),
      end_time: iso(new Date(midPreviousMonth.getTime() + 60 * 60 * 1000)),
      status: 'completed',
      client_id: 'client-3',
      service: { id: 12, name: 'Barba', price: 200 },
      client: { id: 'client-3', full_name: 'João Pedro' },
    },
  ];
  mockTableData.reviews = [{ rating: 5 }, { rating: 4 }];
  mockTableData.referrals = [{ created_at: iso(startOfCurrentMonth) }];
  mockTableData.appointment_reschedules = [];
}

describe('MerchantHomeScreen (redesign)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedFixtures();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'owner-1' } } });
  });

  it('renderiza o GoalOverview ("Visão do mês") após o load', async () => {
    render(<MerchantHomeScreen />);

    expect(await screen.findByText('Visão do mês')).toBeTruthy();
    // Como há receita do mês anterior (R$ 200), NÃO cai no estado neutro.
    expect(screen.queryByTestId('goal-overview-empty')).toBeNull();
  });

  it('renderiza ao menos os KpiCards de "Agendamentos" e "Avaliação"', async () => {
    render(<MerchantHomeScreen />);

    expect(await screen.findByText('Agendamentos')).toBeTruthy();
    expect(screen.getByText('Avaliação')).toBeTruthy();
  });

  it('lista um próximo agendamento e "Ver todos" navega para /(merchant)/dashboard', async () => {
    render(<MerchantHomeScreen />);

    // O cliente do agendamento futuro aparece no cabeçalho da linha.
    expect(await screen.findByText('Maria Oliveira')).toBeTruthy();

    fireEvent.press(screen.getByText('Ver todos'));
    expect(mockPush).toHaveBeenCalledWith('/(merchant)/dashboard');
  });

  it('abre o drawer ao pressionar o menu (item "Configurações" fica visível)', async () => {
    render(<MerchantHomeScreen />);
    await screen.findByText('Visão do mês');

    // Drawer fechado: o item não está visível.
    expect(screen.queryByText('Configurações')).toBeNull();

    fireEvent.press(screen.getByTestId('topbar-menu'));

    expect(await screen.findByText('Configurações')).toBeTruthy();
  });

  it('renderiza o RevenueDonut ("Receita por serviço")', async () => {
    render(<MerchantHomeScreen />);

    expect(await screen.findByText('Receita por serviço')).toBeTruthy();
  });
});
