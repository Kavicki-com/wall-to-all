/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import MerchantProfileScreen from '../app/(merchant)/profile/index';
import { renderWithProviders } from './test-utils';
import { loadMerchantKpis } from '../lib/merchant/merchantKpis';
import type { ProfileStampsService } from '../lib/services/profileTypes';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockProfile = {
  id: 42,
  business_name: 'Hothog Barber Shop',
  description: 'Cortes masculinos e femininos',
  logo_url: null,
  banner_url: null,
  address: 'Rua das Flores, 123',
  work_days: null,
  accepted_payment_methods: { pix: true, card: true, cash: true },
};

jest.mock('../context/BusinessProfileContext', () => ({
  useBusinessProfile: () => ({
    businessProfile: mockProfile,
    loading: false,
    error: null,
    refreshBusinessProfile: async () => undefined,
  }),
}));

// Fundo decorativo em SVG (o jest-expo trata .svg como asset).
jest.mock('../components/profile/BricksBackground', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/profile/stampArt', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const art = () => () => ReactMock.createElement(View);
  return {
    STAMP_ART: {
      five_stars: { active: art(), disabled: art(), aspect: 1 },
      full_schedule: { active: art(), disabled: art(), aspect: 1 },
    },
  };
});

jest.mock('../lib/merchant/merchantKpis', () => {
  const actual = jest.requireActual('../lib/merchant/merchantKpis');
  return { ...actual, loadMerchantKpis: jest.fn() };
});

const mockTableData: Record<string, unknown[]> = {
  services: [{ id: 7, name: 'Corte de Cabelo Masculino', price: 65, photos: [] }],
  reviews: [{ rating: 5 }],
};

jest.mock('../lib/supabase', () => {
  const chainMethods = ['select', 'eq', 'order', 'in', 'gte', 'lte', 'lt', 'limit'];
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of chainMethods) builder[method] = () => builder;
    builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: mockTableData[table] ?? [], error: null });
    return builder;
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'owner-1' } } }) },
      from: (table: string) => buildQuery(table),
    },
  };
});

const mockLoadKpis = loadMerchantKpis as jest.MockedFunction<typeof loadMerchantKpis>;

const figmaKpis = {
  agendamentos: { value: '24', delta: { text: '+12%', up: true } },
  avaliacao: { value: '4.8', delta: null },
  indicacoes: { value: '8', delta: null },
  novosClientes: { value: '25', delta: { text: '+12', up: true } },
};

beforeEach(() => {
  mockPush.mockClear();
  mockLoadKpis.mockReset();
  mockLoadKpis.mockResolvedValue(figmaKpis);
});

describe('MerchantProfileScreen (profile-view F7)', () => {
  it('shows both earned stamps', async () => {
    renderWithProviders(<MerchantProfileScreen />);
    expect(await screen.findByTestId('stamp-five_stars-active')).toBeTruthy();
    expect(screen.getByTestId('stamp-full_schedule-active')).toBeTruthy();
  });

  it('shows the four KPIs loaded for the business', async () => {
    const { qi } = renderWithProviders(<MerchantProfileScreen />);
    expect(await screen.findByText('24')).toBeTruthy();
    for (const label of ['Agendamentos', 'Avaliação', 'Indicações', 'Novos clientes']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('4.8')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(mockLoadKpis).toHaveBeenCalledWith(42, qi);
  });

  it('does not show the address card', async () => {
    renderWithProviders(<MerchantProfileScreen />);
    await screen.findByText('24');
    expect(screen.queryByText('Rua das Flores, 123')).toBeNull();
  });

  it('keeps the screen when the KPI loader fails, with default values', async () => {
    mockLoadKpis.mockRejectedValue(new Error('offline'));
    renderWithProviders(<MerchantProfileScreen />);
    expect(await screen.findByText('Corte de Cabelo Masculino')).toBeTruthy();
    expect(screen.getByText('Editar Perfil')).toBeTruthy();
    expect(screen.getByTestId('profile-kpi-agendamentos')).toBeTruthy();
    expect(screen.queryByText('24')).toBeNull();
  });

  it('hides the stamps row when stamps fail to load', async () => {
    const stamps: ProfileStampsService = { getStamps: () => Promise.reject(new Error('x')) };
    renderWithProviders(<MerchantProfileScreen />, { stamps });
    expect(await screen.findByText('24')).toBeTruthy();
    expect(screen.queryByTestId(/^stamp-/)).toBeNull();
    expect(screen.getByText('Corte de Cabelo Masculino')).toBeTruthy();
  });

  it('keeps the edit profile and new service actions', async () => {
    renderWithProviders(<MerchantProfileScreen />);
    await screen.findByText('24');
    fireEvent.press(screen.getByText('Editar Perfil'));
    expect(mockPush).toHaveBeenCalledWith('/(merchant)/profile/edit');
    fireEvent.press(screen.getByText('Cadastrar novo serviço'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(merchant)/services/create'));
  });
});
