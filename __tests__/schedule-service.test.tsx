/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock */
/**
 * Passo "Serviço" do agendamento (F5, Task 7): CTA "Continuar" sempre visível,
 * desabilitado até o cliente escolher um serviço (Figma 2663:7937 / 2663:7960).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ businessId: '10' }),
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
    router: { replace: jest.fn(), back: jest.fn() },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
  };
});

// AppHeader puxa Auth/Notifications; aqui só importa que a tela renderize.
jest.mock('../components/layout/AppHeader', () => ({ __esModule: true, default: () => null }));

jest.mock('../lib/supabase', () => {
  const services = [
    { id: 1, name: 'Corte de Cabelo Masculino', price: 65, photos: [], rating: 4.8, review_count: 25 },
    { id: 2, name: 'Corte de Cabelo Feminino', price: 115, photos: [], rating: 4.8, review_count: 25 },
    { id: 3, name: 'Hidratação de cabelos', price: 90, photos: [], rating: 4.8, review_count: 25 },
  ];
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.single = () => Promise.resolve({ data: { business_name: 'Loja' }, error: null });
    builder.order = () =>
      Promise.resolve({ data: table === 'services' ? services : [], error: null });
    return builder;
  };
  return { supabase: { from: (table: string) => buildQuery(table) } };
});

import ScheduleServiceScreen from '../app/(client)/schedule/service';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScheduleServiceScreen (CTA sempre visível)', () => {
  it('shows the title and a disabled continue button before selection', async () => {
    const screen = render(<ScheduleServiceScreen />);
    expect(await screen.findByText('Serviços disponíveis')).toBeTruthy();
    expect(screen.getByText('Corte de Cabelo Masculino')).toBeTruthy();

    const cta = screen.getByRole('button', { name: 'Continuar para seleção de data' });
    expect(cta.props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(screen.getByText('Continuar'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('enables continue after picking a service and pushes to the time step', async () => {
    const screen = render(<ScheduleServiceScreen />);
    fireEvent.press(await screen.findByText('Corte de Cabelo Feminino'));

    const cta = screen.getByRole('button', { name: 'Continuar para seleção de data' });
    expect(cta.props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/schedule/time',
      params: { businessId: '10', serviceId: 2 },
    });
  });
});
