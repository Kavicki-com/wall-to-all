/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock */
/**
 * Passo "Data e hora" do agendamento (F5, Task 7): CTA "Continuar" sempre
 * visível, desabilitado até o cliente escolher um horário livre
 * (Figma 2663:7983 / 2663:8015).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ businessId: '10', serviceId: '20', date: '2099-03-16' }),
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

jest.mock('../lib/utils', () => ({
  ...jest.requireActual('../lib/utils'),
  applyAcceptedReschedules: (list: unknown[]) => Promise.resolve(list),
}));

jest.mock('../lib/supabase', () => {
  // Todos os dias abertos, para o teste não depender do dia da semana.
  const day = { start: '10:00', end: '18:00' };
  const rows: Record<string, unknown> = {
    business_profiles: {
      work_days: {
        sunday: day,
        monday: day,
        tuesday: day,
        wednesday: day,
        thursday: day,
        friday: day,
        saturday: day,
      },
      lunch_break_start: '12:00',
      lunch_break_end: '13:00',
    },
    services: { duration_minutes: 60, name: 'Corte' },
  };
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.gte = () => builder;
    builder.lt = () => builder;
    builder.in = () => Promise.resolve({ data: [], error: null });
    builder.single = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    return builder;
  };
  return { supabase: { from: (table: string) => buildQuery(table) } };
});

import ScheduleTimeScreen from '../app/(client)/schedule/time';

const CTA_NAME = 'Continuar para confirmação do agendamento';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScheduleTimeScreen (CTA sempre visível)', () => {
  it('shows a disabled continue button before picking a slot', async () => {
    const screen = render(<ScheduleTimeScreen />);
    await screen.findByText('10h às 11h');

    const cta = screen.getByRole('button', { name: CTA_NAME });
    expect(cta.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByText('Continuar'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('marks the lunch slot as unavailable', async () => {
    const screen = render(<ScheduleTimeScreen />);
    await screen.findByText('12h às 13h');

    expect(screen.getByText('Almoço')).toBeTruthy();
    const lunch = screen.getByRole('button', { name: 'Horário 12h às 13h, horário de almoço' });
    expect(lunch.props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(lunch);
    const cta = screen.getByRole('button', { name: CTA_NAME });
    expect(cta.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('enables continue after picking a free slot and pushes to confirm', async () => {
    const screen = render(<ScheduleTimeScreen />);
    fireEvent.press(await screen.findByText('10h às 11h'));

    const cta = screen.getByRole('button', { name: CTA_NAME });
    expect(cta.props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/schedule/confirm',
      params: expect.objectContaining({
        businessId: '10',
        serviceId: '20',
        date: '2099-03-16',
        time: '10:00',
      }),
    });
  });
});
