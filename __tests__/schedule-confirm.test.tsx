/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock */
/**
 * Confirmação do agendamento com pagamento mock (F5, Task 6).
 *
 * Supabase mockado só para carregar serviço e loja (`single()` por tabela); a
 * criação do agendamento é o `createAppointment` mockado (coberto à parte em
 * booking-create-appointment.test.ts). Carteira e registro de pagamento são os
 * mocks reais com latência 0 injetados por `renderWithProviders`. Timers reais:
 * o "Processando" do cartão e o do Pix duram ~600ms, cobertos pelo timeout do
 * findBy.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockWalletService } from '../lib/services/mock/mockWalletService';
import { BookingError, createAppointment } from '../lib/booking/createAppointment';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
    useLocalSearchParams: () => ({
      businessId: '10',
      serviceId: '20',
      date: '2099-03-15',
      time: '10:00',
    }),
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
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
// SVGs viram objeto no Jest (o transformer de SVG é do Metro): stub do logo do
// "Processando seu pagamento...", como nos demais testes que renderizam assets.
jest.mock('../lib/assets', () => ({
  ...jest.requireActual('../lib/assets'),
  IconLoading: () => null,
}));

jest.mock('../lib/supabase', () => {
  const rows: Record<string, unknown> = {
    services: {
      id: 20,
      name: 'Corte',
      price: 65,
      description: null,
      duration_minutes: 60,
    },
    business_profiles: {
      id: 10,
      business_name: 'Barbearia do Zé',
      address: 'Rua A, 1',
      logo_url: null,
    },
  };
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.single = () => Promise.resolve({ data: rows[table] ?? null, error: null });
    return builder;
  };
  return { supabase: { from: (table: string) => buildQuery(table) } };
});

jest.mock('../lib/booking/createAppointment', () => {
  const actual = jest.requireActual('../lib/booking/createAppointment');
  return { ...actual, createAppointment: jest.fn() };
});

import ScheduleConfirmScreen from '../app/(client)/schedule/confirm';

const mockedCreate = createAppointment as jest.MockedFunction<typeof createAppointment>;
const SLOW = { timeout: 3000 };

function renderScreen(wallet = new MockWalletService({ latencyMs: 0 })) {
  return renderWithProviders(
    <ToastProvider>
      <ScheduleConfirmScreen />
    </ToastProvider>,
    { wallet },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreate.mockResolvedValue({ id: 77, startTime: 'a', endTime: 'b' });
});

describe('ScheduleConfirmScreen (pagamento do agendamento)', () => {
  it('loads service and store with pix as the default method', async () => {
    const screen = renderScreen();
    await screen.findByText('Corte');
    expect(screen.getByText('R$ 65,00')).toBeTruthy();
    expect(screen.getByText('Barbearia do Zé')).toBeTruthy();
    expect(screen.getByText('Pagamento via PIX')).toBeTruthy();

    fireEvent.press(screen.getByText('Cartão'));
    expect(await screen.findByText('•••• 4242')).toBeTruthy();
  });

  it('charges the card, creates the appointment and records the payment', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const paySpy = jest.spyOn(wallet, 'payWithCard');
    const screen = renderScreen(wallet);
    await screen.findByText('Corte');

    fireEvent.press(screen.getByText('Cartão'));
    await screen.findByText('•••• 4242');
    fireEvent.press(screen.getByText('Realizar pagamento'));

    expect(await screen.findByText('Processando seu pagamento...')).toBeTruthy();
    expect(paySpy).toHaveBeenCalledWith('card_visa_1', 6500, 'Agendamento · Corte');

    fireEvent.press(await screen.findByText('Fechar', {}, SLOW));
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'card', businessId: 10, serviceId: 20 }),
    );
    await expect(screen.booking.getPayment(77)).resolves.toMatchObject({
      status: 'paid',
      method: 'card',
      cardLast4: '4242',
      amountCents: 6500,
    });
    expect(mockReplace).toHaveBeenCalledWith('/(client)/appointments');
  });

  it('does not create the appointment when the card is declined', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'payWithCard').mockResolvedValue({ status: 'declined' });
    const screen = renderScreen(wallet);
    await screen.findByText('Corte');

    fireEvent.press(screen.getByText('Cartão'));
    await screen.findByText('•••• 4242');
    fireEvent.press(screen.getByText('Realizar pagamento'));

    expect(
      await screen.findByText('Pagamento recusado. Tente outro cartão.', {}, SLOW),
    ).toBeTruthy();
    expect(screen.queryByText('Processando seu pagamento...')).toBeNull();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(screen.getByText('Realizar pagamento')).toBeTruthy();
  });

  it('pays with pix through the pix sheet', async () => {
    const screen = renderScreen();
    await screen.findByText('Corte');

    fireEvent.press(screen.getByText('Realizar pagamento'));
    fireEvent.press(await screen.findByText('Já realizei o pagamento'));

    await screen.findByText('Agendamento concluído', {}, SLOW);
    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'pix' }));
    await expect(screen.booking.getPayment(77)).resolves.toMatchObject({
      status: 'paid',
      method: 'pix',
    });
  });

  it('pays on site with cash (pay now disabled)', async () => {
    const screen = renderScreen();
    await screen.findByText('Corte');

    fireEvent.press(screen.getByText('Dinheiro'));
    const payNow = screen.getByRole('button', { name: 'Realizar pagamento' });
    expect(payNow.props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(screen.getByText('Pagar na hora'));
    await screen.findByText('Agendamento concluído', {}, SLOW);
    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'cash' }));
    await expect(screen.booking.getPayment(77)).resolves.toMatchObject({
      status: 'pay_on_site',
      method: 'cash',
    });
  });

  it('switches the card through the cards sheet', async () => {
    const screen = renderScreen();
    await screen.findByText('Corte');

    fireEvent.press(screen.getByText('Cartão'));
    await screen.findByText('•••• 4242');
    fireEvent.press(screen.getByText('Alterar'));
    await screen.findByText('Meus cartões');
    fireEvent.press(screen.getByTestId('cards-stack-card-1'));
    fireEvent.press(screen.getByText('Selecionar cartão'));

    expect(await screen.findByText('•••• 5454')).toBeTruthy();
    expect(screen.queryByText('Meus cartões')).toBeNull();
  });

  it('disables pay now when there is no saved card', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'getCards').mockResolvedValue([]);
    const screen = renderScreen(wallet);
    await screen.findByText('Corte');

    fireEvent.press(screen.getByText('Cartão'));
    expect(await screen.findByText('Nenhum cartão salvo')).toBeTruthy();
    const payNow = screen.getByRole('button', { name: 'Realizar pagamento' });
    expect(payNow.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('shows the booking error and records no payment', async () => {
    mockedCreate.mockRejectedValue(
      new BookingError('conflict', 'Selecione outro horário, este já está ocupado.'),
    );
    const screen = renderScreen();
    await screen.findByText('Corte');

    fireEvent.press(screen.getByText('Dinheiro'));
    fireEvent.press(screen.getByText('Pagar na hora'));

    expect(await screen.findByText('Selecione outro horário, este já está ocupado.')).toBeTruthy();
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    await expect(screen.booking.getPayment(77)).resolves.toBeNull();
    expect(screen.queryByText('Agendamento concluído')).toBeNull();
  });
});
