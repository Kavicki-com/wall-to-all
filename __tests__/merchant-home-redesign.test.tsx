/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
/**
 * Testes de comportamento da home do LOJISTA redesenhada (F2 — Dashboards/Home,
 * Task 7, node 2478:111).
 *
 * A tela é Supabase-backed: mockamos `lib/supabase` no escopo do módulo (auth +
 * um query-builder encadeável que resolve dados por tabela via `mockTableData`,
 * com `.single()` p/ o perfil), `expo-router` (useRouter → mockPush,
 * useFocusEffect → no-op), `react-native-safe-area-context`, o NotificationContext,
 * o NotificationModal (stub) e o ToastProvider (showError).
 *
 * Além do render das seções, os testes GUARDAM os bugs de métrica corrigidos na
 * revisão: "Realizado" NÃO conta agendamentos futuros do mês; a contagem
 * "Agendamentos" ignora cancelados; a linha de agendamento navega para o detalhe;
 * e cancelados futuros não aparecem em "Próximos agendamentos".
 *
 * Obs.: strings BRL usam espaço NÃO-quebrável (Intl.NumberFormat) — asserções de
 * valor casam por REGEX nos dígitos (com "R$"), nunca pela string literal.
 */
import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react-native';

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
  const chainMethods = [
    'select',
    'eq',
    'neq',
    'order',
    'gte',
    'lte',
    'lt',
    'limit',
    'range',
    'in',
  ];
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

// Stub leve do NotificationModal: expõe apenas se está visível.
jest.mock('../components/notifications/NotificationModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) =>
      visible ? React.createElement(View, { testID: 'notif-modal' }) : null,
  };
});

// ToastProvider: só precisamos de showError (usado no catch da carga).
const mockShowError = jest.fn();
jest.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }),
}));

jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import MerchantHomeScreen from '../app/(merchant)/home/index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const now = new Date();
const iso = (d: Date) => d.toISOString();

// Datas relativas a "agora" para robustez independente da data de execução.
// Início do mês (00:00) é SEMPRE passado (now está dentro do mês) e no mês corrente.
const currentMonthPast = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
const midPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0);
const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
// Futuro GARANTIDO no mês corrente: now+1d limitado ao fim do mês (evita cruzar o
// mês perto do fim → contagem/realizado deterministas mesmo no último dia).
const futureThisMonth = new Date(
  Math.min(now.getTime() + 24 * 60 * 60 * 1000, endOfCurrentMonth.getTime()),
);
const futureCanceled = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

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
    // FUTURO no mês corrente, confirmado — aparece em "Próximos agendamentos" e
    // NÃO deve entrar no "Realizado" (guarda do bug de receita futura).
    {
      id: 101,
      start_time: iso(futureThisMonth),
      end_time: iso(new Date(futureThisMonth.getTime() + 60 * 60 * 1000)),
      status: 'confirmed',
      client_id: 'client-1',
      service: { id: 10, name: 'Corte masculino', price: 65 },
      client: { id: 'client-1', full_name: 'Maria Oliveira' },
    },
    // Realizado neste mês (passado) — receita/contagem/donut/cliente do mês.
    {
      id: 102,
      start_time: iso(currentMonthPast),
      end_time: iso(new Date(currentMonthPast.getTime() + 60 * 60 * 1000)),
      status: 'completed',
      client_id: 'client-2',
      service: { id: 11, name: 'Escova', price: 90 },
      client: { id: 'client-2', full_name: 'Carlos Silveira' },
    },
    // Mês anterior — meta (previousRevenue) do GoalOverview + delta.
    {
      id: 103,
      start_time: iso(midPreviousMonth),
      end_time: iso(new Date(midPreviousMonth.getTime() + 60 * 60 * 1000)),
      status: 'completed',
      client_id: 'client-3',
      service: { id: 12, name: 'Barba', price: 200 },
      client: { id: 'client-3', full_name: 'João Pedro' },
    },
    // CANCELADO no mês corrente (passado) — NÃO deve entrar na contagem
    // "Agendamentos" (guarda do bug de status na contagem).
    {
      id: 104,
      start_time: iso(currentMonthPast),
      end_time: iso(new Date(currentMonthPast.getTime() + 60 * 60 * 1000)),
      status: 'canceled',
      client_id: 'client-4',
      service: { id: 13, name: 'Cancelado', price: 500 },
      client: { id: 'client-4', full_name: 'Cliente Cancelado' },
    },
    // CANCELADO no futuro — NÃO deve aparecer em "Próximos agendamentos".
    {
      id: 105,
      start_time: iso(futureCanceled),
      end_time: iso(new Date(futureCanceled.getTime() + 60 * 60 * 1000)),
      status: 'canceled',
      client_id: 'client-5',
      service: { id: 14, name: 'Corte cancelado', price: 70 },
      client: { id: 'client-5', full_name: 'Fantasma Futuro' },
    },
  ];
  mockTableData.reviews = [{ rating: 5 }, { rating: 4 }];
  mockTableData.referrals = [{ created_at: iso(currentMonthPast) }];
  mockTableData.appointment_reschedules = [];
}

describe('MerchantHomeScreen (redesign)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedFixtures();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'owner-1' } } });
  });

  it('GoalOverview: "Realizado" reflete só o passado (agendamento futuro do mês não infla)', async () => {
    render(<MerchantHomeScreen />);
    await screen.findByText('Visão do mês');

    // Há receita do mês anterior (R$ 200) → NÃO é o estado neutro.
    expect(screen.queryByTestId('goal-overview-empty')).toBeNull();

    // Realizado = R$ 90 (só o agendamento passado 102). Se o bug existisse, o
    // futuro confirmado (R$ 65) somaria R$ 155 — que NÃO pode aparecer.
    expect(screen.getAllByText(/R\$\s*90\b/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/R\$\s*155\b/)).toBeNull();
  });

  it('KPIs: "Avaliação" 4.5 e "Agendamentos" 2 (cancelado não conta)', async () => {
    render(<MerchantHomeScreen />);
    await screen.findByText('Visão do mês');

    // Avaliação = média de [5, 4] = 4.5.
    expect(within(screen.getByTestId('kpi-avaliacao')).getByText('4.5')).toBeTruthy();
    // Agendamentos = confirmado(101) + concluído(102) = 2; o cancelado(104) fica de fora.
    expect(within(screen.getByTestId('kpi-agendamentos')).getByText('2')).toBeTruthy();
  });

  it('Próximos agendamentos: lista o agendamento, navega para o detalhe e "Ver todos"', async () => {
    render(<MerchantHomeScreen />);

    // O cliente do agendamento futuro aparece; o cancelado futuro NÃO.
    expect(await screen.findByText('Maria Oliveira')).toBeTruthy();
    expect(screen.queryByText('Fantasma Futuro')).toBeNull();

    // Toque na linha → detalhe do agendamento 101.
    fireEvent.press(screen.getByTestId('upcoming-appt-101'));
    expect(mockPush).toHaveBeenCalledWith('/(merchant)/dashboard/appointment/101');

    // "Ver todos" → agenda completa.
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
