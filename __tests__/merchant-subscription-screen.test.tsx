/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import MerchantSubscriptionScreen from '../app/(merchant)/assinatura/index';
import { renderWithProviders } from './test-utils';
import { MockSubscriptionService } from '../lib/services/mock/mockSubscriptionService';
import type { MockSubscriptionServiceOptions } from '../lib/services/mock/mockSubscriptionService';
import { MockWalletService } from '../lib/services/mock/mockWalletService';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const ReactMock = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (cb: () => void) => ReactMock.useEffect(cb, [cb]),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ unreadCount: 0, refreshNotifications: jest.fn() }),
}));

jest.mock('../components/notifications/NotificationModal', () => ({
  __esModule: true,
  default: () => null,
}));

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
jest.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showInfo: jest.fn() }),
}));

// SVGs viram objeto no Jest (o transformer de SVG é do Metro): stub do logo do
// "Processando seu pagamento...", como em schedule-confirm.test.tsx.
jest.mock('../lib/assets', () => ({
  ...jest.requireActual('../lib/assets'),
  IconLoading: () => null,
}));

jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

const now = () => new Date('2026-05-20T12:00:00.000Z');

function renderScreen(
  options: MockSubscriptionServiceOptions = {},
  wallet: MockWalletService = new MockWalletService(),
) {
  const subscription = new MockSubscriptionService({ latencyMs: 0, now, ...options });
  const result = renderWithProviders(<MerchantSubscriptionScreen />, { subscription, wallet });
  return { ...result, subscription };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MerchantSubscriptionScreen', () => {
  it('shows the title and the offer when there is no subscription', async () => {
    renderScreen();
    expect(await screen.findByText('Wall to All Premium')).toBeTruthy();
    expect(screen.getByText('Minha assinatura')).toBeTruthy();
    expect(screen.getByText('PLANO ÚNICO')).toBeTruthy();
  });

  it('subscribes with the selected card and lands on manage', async () => {
    renderScreen();
    fireEvent.press(await screen.findByText('Assinar por R$ 29,90/mês'));
    await screen.findByText('Meus cartões');
    fireEvent.press(screen.getByText('Selecionar cartão'));

    expect(await screen.findByText('Processando seu pagamento...')).toBeTruthy();
    expect(await screen.findByText('ATIVO', {}, { timeout: 3000 })).toBeTruthy();
    expect(mockShowSuccess).toHaveBeenCalledWith('Assinatura ativada');
    expect(screen.getByText('•••• 4242')).toBeTruthy();
  });

  it('stays on the offer when the card is declined', async () => {
    renderScreen({ declineCardIds: ['card_visa_1'] });
    fireEvent.press(await screen.findByText('Assinar por R$ 29,90/mês'));
    await screen.findByText('Meus cartões');
    fireEvent.press(screen.getByText('Selecionar cartão'));

    await waitFor(
      () => expect(mockShowError).toHaveBeenCalledWith('Pagamento recusado. Tente outro cartão.'),
      { timeout: 3000 },
    );
    expect(screen.getByText('PLANO ÚNICO')).toBeTruthy();
    expect(screen.queryByText('ATIVO')).toBeNull();
  });

  it('disables subscribing without a saved card', async () => {
    const wallet = new MockWalletService();
    jest.spyOn(wallet, 'getCards').mockResolvedValue([]);
    renderScreen({}, wallet);
    expect(await screen.findByText('Nenhum cartão salvo')).toBeTruthy();
    fireEvent.press(screen.getByText('Assinar por R$ 29,90/mês'));
    expect(screen.queryByText('Meus cartões')).toBeNull();
  });

  it('changes the card of an active subscription', async () => {
    renderScreen({ initial: 'active' });
    expect(await screen.findByText('ATIVO')).toBeTruthy();
    fireEvent.press(screen.getByText('Alterar'));
    await screen.findByText('Meus cartões');
    fireEvent.press(screen.getByTestId('cards-stack-card-1'));
    fireEvent.press(screen.getByText('Selecionar cartão'));
    expect(await screen.findByText('•••• 5454')).toBeTruthy();
    expect(screen.getByText('ATIVO')).toBeTruthy();
  });

  it('charges the open invoice when a past due subscription changes card', async () => {
    renderScreen({ initial: 'past_due' });
    expect(await screen.findByText('PAGAMENTO PENDENTE')).toBeTruthy();
    fireEvent.press(screen.getByText('Alterar'));
    await screen.findByText('Meus cartões');
    fireEvent.press(screen.getByTestId('cards-stack-card-1'));
    fireEvent.press(screen.getByText('Selecionar cartão'));
    expect(await screen.findByText('Processando seu pagamento...')).toBeTruthy();
    expect(await screen.findByText('ATIVO', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('•••• 5454')).toBeTruthy();
  });

  it('cancels after confirmation and resumes', async () => {
    renderScreen({ initial: 'active' });
    fireEvent.press(await screen.findByText('Cancelar assinatura'));
    fireEvent.press(screen.getByTestId('confirm-cancel-subscription'));
    expect(await screen.findByText('CANCELAMENTO AGENDADO')).toBeTruthy();

    fireEvent.press(screen.getByText('Manter assinatura'));
    expect(await screen.findByText('ATIVO')).toBeTruthy();
  });

  it('shows a retry when loading fails', async () => {
    const subscription = new MockSubscriptionService({ latencyMs: 0, now });
    jest.spyOn(subscription, 'getSubscription').mockRejectedValueOnce(new Error('offline'));
    renderWithProviders(<MerchantSubscriptionScreen />, { subscription });

    fireEvent.press(await screen.findByText('Tentar novamente'));
    expect(mockShowError).toHaveBeenCalled();
    expect(await screen.findByText('PLANO ÚNICO')).toBeTruthy();
  });

  it('opens the plan terms and goes back', async () => {
    renderScreen();
    fireEvent.press(await screen.findByText('Termos do plano e política de cobrança'));
    expect(mockPush).toHaveBeenCalledWith('/(merchant)/settings/terms');
    fireEvent.press(screen.getByText('Voltar'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
