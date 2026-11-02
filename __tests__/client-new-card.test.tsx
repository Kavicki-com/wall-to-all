/**
 * Cadastro de cartão do cliente (Figma node 2660:6604) com o `CardField` da
 * Stripe e SetupIntent (F8, Task 14).
 *
 * O SDK vem do mock oficial (`__mocks__/@stripe/stripe-react-native.js`), com o
 * `CardField` trocado por uma `View` com `testID` para disparar `onCardChange`.
 * O serviço é um `MockWalletService` fresco; com `cardSetupConfirmsWithStripe`
 * ligado a tela segue o caminho da Stripe (confirma o SetupIntent no SDK).
 */
import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { confirmSetupIntent } from '@stripe/stripe-react-native';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockWalletService } from '../lib/services/mock/mockWalletService';

jest.mock('@stripe/stripe-react-native', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const base = jest.requireActual('@stripe/stripe-react-native/jest/mock.js');
  return {
    ...base,
    confirmSetupIntent: jest.fn(),
    CardField: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'card-field', ...props }),
  };
});

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import NewCardScreen from '../app/(client)/wallet/new-card';

const mockConfirm = confirmSetupIntent as jest.Mock;

const COMPLETE_CARD = {
  last4: '4242',
  expiryMonth: 12,
  expiryYear: 2034,
  brand: 'Visa',
  complete: true,
  validNumber: 'Valid',
  validCVC: 'Valid',
  validExpiryDate: 'Valid',
};

/** Renderiza e espera o Icon (@expo/vector-icons) terminar de carregar a fonte. */
async function renderScreen(wallet: MockWalletService) {
  const utils = renderWithProviders(
    <ToastProvider>
      <NewCardScreen />
    </ToastProvider>,
    { wallet },
  );
  await act(async () => {});
  return utils;
}

function stripeWallet() {
  return new MockWalletService({ latencyMs: 0, cardSetupConfirmsWithStripe: true });
}

function fillValid(
  getByTestId: ReturnType<typeof renderWithProviders>['getByTestId'],
  card: object = COMPLETE_CARD,
) {
  fireEvent.changeText(getByTestId('input-holder'), 'Maria Silva');
  fireEvent(getByTestId('card-field'), 'cardChange', card);
}

describe('NewCardScreen (CardField + SetupIntent)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue({ setupIntent: { id: 'seti_mock_1', status: 'Succeeded' } });
  });

  it('CTA desabilitada até ter nome E cartão completo', async () => {
    const { getByTestId } = await renderScreen(stripeWallet());
    const cta = () => getByTestId('btn-save-card').props.accessibilityState.disabled;

    expect(cta()).toBe(true);
    fireEvent.changeText(getByTestId('input-holder'), 'Maria Silva');
    expect(cta()).toBe(true);
    fireEvent(getByTestId('card-field'), 'cardChange', { ...COMPLETE_CARD, complete: false });
    expect(cta()).toBe(true);
    fireEvent(getByTestId('card-field'), 'cardChange', COMPLETE_CARD);
    expect(cta()).toBe(false);
    fireEvent.changeText(getByTestId('input-holder'), '   ');
    expect(cta()).toBe(true);
  });

  it('o CardField nunca pede os dados completos do cartão', async () => {
    const { getByTestId } = await renderScreen(stripeWallet());
    expect(getByTestId('card-field').props.dangerouslyGetFullCardDetails).toBeFalsy();
  });

  // O CreditCard (F0) mostra nome e final; a validade não aparece no componente.
  it('preview reflete o final do cartão vindo do onCardChange', async () => {
    const { getByTestId, getByText } = await renderScreen(stripeWallet());
    fireEvent(getByTestId('card-field'), 'cardChange', {
      ...COMPLETE_CARD,
      brand: 'MasterCard',
      last4: '4444',
      expiryMonth: 3,
      expiryYear: 2031,
    });
    expect(getByText(/4444/)).toBeTruthy();
  });

  it('salvar: beginCardSetup, confirmSetupIntent com o nome, completeCardSetup, toast e volta', async () => {
    const wallet = stripeWallet();
    const begin = jest.spyOn(wallet, 'beginCardSetup');
    const complete = jest.spyOn(wallet, 'completeCardSetup');
    const { getByTestId, findByText } = await renderScreen(wallet);

    fillValid(getByTestId);
    await act(async () => fireEvent.press(getByTestId('btn-save-card')));

    expect(begin).toHaveBeenCalledWith();
    expect(mockConfirm).toHaveBeenCalledWith('seti_mock_1_secret_mock1', {
      paymentMethodType: 'Card',
      paymentMethodData: { billingDetails: { name: 'MARIA SILVA' } },
    });
    expect(complete).toHaveBeenCalledWith('seti_mock_1');
    expect(await findByText('Cartão adicionado')).toBeTruthy();
    expect(mockBack).toHaveBeenCalled();
  });

  it('card_declined no confirmSetupIntent → "Cartão recusado", sem completar nem voltar', async () => {
    mockConfirm.mockResolvedValue({
      error: {
        code: 'Failed',
        message: 'Your card was declined.',
        declineCode: 'generic_decline',
        stripeErrorCode: 'card_declined',
      },
    });
    const wallet = stripeWallet();
    const complete = jest.spyOn(wallet, 'completeCardSetup');
    const { getByTestId, findByText } = await renderScreen(wallet);

    fillValid(getByTestId);
    await act(async () => fireEvent.press(getByTestId('btn-save-card')));

    expect(await findByText('Cartão recusado. Tente outro cartão.')).toBeTruthy();
    expect(complete).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(getByTestId('btn-save-card').props.accessibilityState.disabled).toBe(false);
  });

  it('outro erro do SDK → mensagem genérica pt-BR (nada técnico)', async () => {
    mockConfirm.mockResolvedValue({ error: { code: 'Failed', message: 'Internal SDK thing' } });
    const { getByTestId, findByText, queryByText } = await renderScreen(stripeWallet());

    fillValid(getByTestId);
    await act(async () => fireEvent.press(getByTestId('btn-save-card')));

    expect(await findByText('Não foi possível adicionar o cartão.')).toBeTruthy();
    expect(queryByText(/Internal SDK thing/)).toBeNull();
  });

  it('cancelamento no SDK (Canceled) não mostra erro', async () => {
    mockConfirm.mockResolvedValue({ error: { code: 'Canceled', message: 'canceled' } });
    const { getByTestId, queryByText } = await renderScreen(stripeWallet());

    fillValid(getByTestId);
    await act(async () => fireEvent.press(getByTestId('btn-save-card')));

    expect(queryByText('Não foi possível adicionar o cartão.')).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('erro do servidor (PaymentsApiError) mostra a copy pt-BR dele', async () => {
    const wallet = stripeWallet();
    jest
      .spyOn(wallet, 'completeCardSetup')
      .mockRejectedValue(
        Object.assign(new Error('Bandeira de cartão não aceita.'), { name: 'PaymentsApiError' }),
      );
    const { getByTestId, findByText } = await renderScreen(wallet);

    fillValid(getByTestId);
    await act(async () => fireEvent.press(getByTestId('btn-save-card')));

    expect(await findByText('Bandeira de cartão não aceita.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('duplo toque não dispara dois setups', async () => {
    const wallet = stripeWallet();
    const begin = jest.spyOn(wallet, 'beginCardSetup');
    const { getByTestId } = await renderScreen(wallet);

    fillValid(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('btn-save-card'));
      fireEvent.press(getByTestId('btn-save-card'));
    });

    expect(begin).toHaveBeenCalledTimes(1);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('modo mock (sem Stripe): não chama o SDK e completa o setup direto', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const complete = jest.spyOn(wallet, 'completeCardSetup');
    const { getByTestId } = await renderScreen(wallet);

    fillValid(getByTestId);
    await act(async () => fireEvent.press(getByTestId('btn-save-card')));

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith('seti_mock_1');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
