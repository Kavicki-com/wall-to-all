/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock */
/**
 * Detalhe do agendamento (cliente) com a linha de status do pagamento (F5,
 * Task 8). O registro vem do BookingPaymentService injetado; sem registro, a
 * linha cai no payment_method do appointment.
 */
import React from 'react';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockBookingPaymentService } from '../lib/services/mock/mockBookingPaymentService';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ id: '77' }),
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
jest.mock('../lib/notifications', () => ({
  notifyRescheduleAccepted: jest.fn(),
  notifyRescheduleRejected: jest.fn(),
}));
jest.mock('../lib/utils', () => ({
  ...jest.requireActual('../lib/utils'),
  applyAcceptedReschedules: (list: unknown[]) => Promise.resolve(list),
}));

jest.mock('../lib/supabase', () => {
  const appointment = {
    id: 77,
    client_id: 'user-1',
    business_id: 10,
    service_id: 20,
    start_time: '2099-03-15T13:00:00.000Z',
    end_time: '2099-03-15T14:00:00.000Z',
    status: 'confirmed',
    payment_method: 'pix',
    client_notes: null,
    created_at: '2099-03-01T12:00:00.000Z',
    service: { id: 20, name: 'Corte', price: 65 },
    business: { id: 10, business_name: 'Barbearia do Zé', logo_url: null, address: 'Rua A, 1' },
  };
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.single = () =>
      Promise.resolve({ data: table === 'appointments' ? appointment : null, error: null });
    builder.order = () => Promise.resolve({ data: [], error: null });
    return builder;
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
      from: (table: string) => buildQuery(table),
    },
  };
});

import AppointmentDetailScreen from '../app/(client)/appointments/[id]';

function renderScreen(booking: MockBookingPaymentService) {
  return renderWithProviders(
    <ToastProvider>
      <AppointmentDetailScreen />
    </ToastProvider>,
    { booking },
  );
}

describe('AppointmentDetailScreen (status do pagamento)', () => {
  it('shows the recorded card payment', async () => {
    const booking = new MockBookingPaymentService({ latencyMs: 0 });
    await booking.recordPayment(77, {
      status: 'paid',
      method: 'card',
      amountCents: 6500,
      cardLast4: '4242',
      cardBrand: 'visa',
    });
    const screen = renderScreen(booking);
    expect(await screen.findByText('Pago com cartão •••• 4242')).toBeTruthy();
  });

  it('falls back to the appointment payment method without a record', async () => {
    const screen = renderScreen(new MockBookingPaymentService({ latencyMs: 0 }));
    expect(await screen.findByText('Pagamento: Pix')).toBeTruthy();
  });

  it('keeps the screen when the payment lookup fails', async () => {
    const booking = new MockBookingPaymentService({ latencyMs: 0 });
    jest.spyOn(booking, 'getPayment').mockRejectedValue(new Error('boom'));
    const screen = renderScreen(booking);
    expect(await screen.findByText('Pagamento: Pix')).toBeTruthy();
    expect(screen.getByText('Corte')).toBeTruthy();
  });
});
