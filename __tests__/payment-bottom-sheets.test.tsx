import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockWalletService } from '../lib/services/mock/mockWalletService';
import { PaymentPixBottomSheet } from '../components/payment/PaymentPixBottomSheet';
import { PaymentCardBottomSheet } from '../components/payment/PaymentCardBottomSheet';
import type { PixCharge } from '../lib/services/types';
import * as Clipboard from 'expo-clipboard';

// A área de transferência é nativa: mockamos apenas o método usado. O teste
// espia `setStringAsync` para provar que "Copiar código PIX" copia o payload.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

// SVGs viram objeto no Jest: stub do logo do PaymentProcessingSheet (F8: o sheet
// Pix usa o "Processando" compartilhado da F5).
jest.mock('../lib/assets', () => ({
  ...jest.requireActual('../lib/assets'),
  IconLoading: () => null,
}));

// Cobrança Pix determinística (copyPasteCode distinto p/ asserção direta na UI).
const PIX_CHARGE: PixCharge = {
  qrCode: '00020126QRPAYLOAD5204000053039865802BR6304QRQR',
  copyPasteCode: '00020126COPIAECOLA5204000053039865802BR5909Wall2All6304C0DE',
  amountCents: 9500,
  expiresAt: '2026-07-09T12:00:00.000Z',
};

const AMOUNT = 9500;
const DESCRIPTION = 'Fura-fila · Barbearia do Zé';
const noop = (): void => undefined;

describe('PaymentPixBottomSheet', () => {
  beforeEach(() => jest.clearAllMocks());
  // Garante que timers reais sejam restaurados mesmo se um teste falhar no meio.
  afterEach(() => jest.useRealTimers());

  it('creates the Pix charge with the amount/description and shows the copy-paste code', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const chargeSpy = jest.spyOn(wallet, 'createPixCharge').mockResolvedValue(PIX_CHARGE);

    const { findByText } = renderWithProviders(
      <PaymentPixBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={noop}
        onClose={noop}
      />,
      { wallet },
    );

    await waitFor(() => expect(chargeSpy).toHaveBeenCalledWith(AMOUNT, DESCRIPTION, undefined));
    // O copia-e-cola aparece em destaque para o usuário colar no app do banco.
    await findByText(PIX_CHARGE.copyPasteCode);
  });

  it('copies the copyPasteCode to the clipboard when "Copiar código PIX" is pressed', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'createPixCharge').mockResolvedValue(PIX_CHARGE);

    const { findByText, getByText } = renderWithProviders(
      <PaymentPixBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={noop}
        onClose={noop}
      />,
      { wallet },
    );

    // Espera a cobrança carregar (código na tela) antes de copiar.
    await findByText(PIX_CHARGE.copyPasteCode);
    fireEvent.press(getByText('Copiar código PIX'));

    await waitFor(() =>
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(PIX_CHARGE.copyPasteCode),
    );
  });

  it('shows the "Processando..." state and calls onSuccess after a brief delay', async () => {
    const onSuccess = jest.fn();
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'createPixCharge').mockResolvedValue(PIX_CHARGE);

    const { findByText, getByText } = renderWithProviders(
      <PaymentPixBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={onSuccess}
        onClose={noop}
      />,
      { wallet },
    );

    // Carrega a cobrança com timers reais (microtask); só então usa fake timers
    // para exercitar o atraso do "Processando..." (setTimeout de 600ms).
    const confirm = await findByText('Já realizei o pagamento');
    jest.useFakeTimers();
    fireEvent.press(confirm);

    // O "Processando..." compartilhado (F5) pinta antes do onSuccess.
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByText('Processando seu pagamento...')).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('renders nothing and does not create a charge when not visible', () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const chargeSpy = jest.spyOn(wallet, 'createPixCharge');

    const { queryByText } = renderWithProviders(
      <PaymentPixBottomSheet
        visible={false}
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={noop}
        onClose={noop}
      />,
      { wallet },
    );

    expect(queryByText('Pagamento via PIX')).toBeNull();
    expect(chargeSpy).not.toHaveBeenCalled();
  });
});

describe('PaymentCardBottomSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the saved cards and pays the default one, then calls onSuccess (approved)', async () => {
    const onSuccess = jest.fn();
    const wallet = new MockWalletService({ latencyMs: 0 });
    const paySpy = jest.spyOn(wallet, 'payWithCard');

    const { findByText, getByText } = renderWithProviders(
      <PaymentCardBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={onSuccess}
        onClose={noop}
      />,
      { wallet },
    );

    // Cartões salvos renderizados via PaymentCardRow (Task 12) — last4 visível.
    await findByText('•••• 4242'); // Visa (default)
    await findByText('•••• 5454'); // Mastercard

    fireEvent.press(getByText('Concluir Pagamento'));

    // Default = cartão isDefault (Visa) → paga esse id.
    await waitFor(() =>
      expect(paySpy).toHaveBeenCalledWith('card_visa_1', AMOUNT, DESCRIPTION, undefined),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('pays the card the user selects instead of the default', async () => {
    const onSuccess = jest.fn();
    const wallet = new MockWalletService({ latencyMs: 0 });
    const paySpy = jest.spyOn(wallet, 'payWithCard');

    const { findByText, getByText, getByLabelText } = renderWithProviders(
      <PaymentCardBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={onSuccess}
        onClose={noop}
      />,
      { wallet },
    );

    await findByText('•••• 5454');
    // Seleciona o Mastercard (não-default) pela label acessível da linha.
    fireEvent.press(getByLabelText('Cartão mastercard terminado em 5454'));
    fireEvent.press(getByText('Concluir Pagamento'));

    await waitFor(() =>
      expect(paySpy).toHaveBeenCalledWith('card_mastercard_1', AMOUNT, DESCRIPTION, undefined),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('shows a decline state and does not call onSuccess when the card is declined', async () => {
    const onSuccess = jest.fn();
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'payWithCard').mockResolvedValue({ status: 'declined' });

    const { findByText, getByText } = renderWithProviders(
      <PaymentCardBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={onSuccess}
        onClose={noop}
      />,
      { wallet },
    );

    await findByText('•••• 4242');
    fireEvent.press(getByText('Concluir Pagamento'));

    await findByText(/recusad/i); // mensagem de recusa
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('renders nothing and does not load cards when not visible', () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const cardsSpy = jest.spyOn(wallet, 'getCards');

    const { queryByText } = renderWithProviders(
      <PaymentCardBottomSheet
        visible={false}
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={noop}
        onClose={noop}
      />,
      { wallet },
    );

    expect(queryByText('Pagamento com cartão')).toBeNull();
    expect(cardsSpy).not.toHaveBeenCalled();
  });
});

describe('PaymentPixBottomSheet (F8: confirmado pelo servidor)', () => {
  const CTX = {
    purpose: { kind: 'fura_fila' as const, merchantRef: 'm1' },
    idempotencyKey: 'chk_teste123',
  };

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.useRealTimers());

  function renderPix(wallet: MockWalletService, onSuccess = jest.fn(), pollIntervalMs?: number) {
    const utils = renderWithProviders(
      <PaymentPixBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        context={CTX}
        onSuccess={onSuccess}
        onClose={noop}
        pollIntervalMs={pollIntervalMs}
      />,
      { wallet },
    );
    return { ...utils, onSuccess };
  }

  it('shows the Stripe QR image when there is one, else the placeholder', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest
      .spyOn(wallet, 'createPixCharge')
      .mockResolvedValueOnce({ ...PIX_CHARGE, paymentId: 'p1', qrImageUrl: 'https://qr/x.png' });
    const withImage = renderPix(wallet);
    expect(await withImage.findByTestId('pix-qr-image')).toBeTruthy();
    withImage.unmount();

    const placeholder = renderPix(new MockWalletService({ latencyMs: 0 }));
    await placeholder.findByText('Já realizei o pagamento');
    expect(placeholder.queryByTestId('pix-qr-image')).toBeNull();
    expect(placeholder.getByLabelText('QR Code do pagamento Pix')).toBeTruthy();
  });

  it('passes the context to createPixCharge', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const spy = jest.spyOn(wallet, 'createPixCharge');
    const { findByText } = renderPix(wallet);
    await findByText('Já realizei o pagamento');
    expect(spy).toHaveBeenCalledWith(AMOUNT, DESCRIPTION, CTX);
  });

  it('polls the payment status and calls onSuccess once when it succeeds', async () => {
    const wallet = new MockWalletService({ latencyMs: 0, pixAutoConfirm: false });
    const statusSpy = jest
      .spyOn(wallet, 'getPaymentStatus')
      .mockResolvedValueOnce('processing')
      .mockResolvedValue('succeeded');
    const { findByText, onSuccess } = renderPix(wallet, jest.fn(), 20);
    await findByText('Já realizei o pagamento');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/^pay_mock_/));
    expect(statusSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Concluído: o polling para e o onSuccess não repete.
    const calls = statusSpy.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(statusSpy.mock.calls.length).toBe(calls);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('"Já realizei o pagamento" checks now and warns when not paid yet', async () => {
    const wallet = new MockWalletService({ latencyMs: 0, pixAutoConfirm: false });
    const statusSpy = jest.spyOn(wallet, 'getPaymentStatus');
    const { findByText, getByText, onSuccess } = renderPix(wallet);

    fireEvent.press(await findByText('Já realizei o pagamento'));
    expect(await findByText('Ainda não identificamos o pagamento')).toBeTruthy();
    expect(statusSpy).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(getByText('Já realizei o pagamento')).toBeTruthy();
  });

  it('"Já realizei o pagamento" concludes when the server already has it', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByText, onSuccess } = renderPix(wallet);
    fireEvent.press(await findByText('Já realizei o pagamento'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });

  it('stops polling when closed', async () => {
    const wallet = new MockWalletService({ latencyMs: 0, pixAutoConfirm: false });
    const statusSpy = jest.spyOn(wallet, 'getPaymentStatus');
    const onSuccess = jest.fn();
    const utils = renderPix(wallet, onSuccess, 20);
    await utils.findByText('Já realizei o pagamento');
    await waitFor(() => expect(statusSpy).toHaveBeenCalled());

    utils.rerender(
      <PaymentPixBottomSheet
        visible={false}
        amountCents={AMOUNT}
        description={DESCRIPTION}
        context={CTX}
        onSuccess={onSuccess}
        onClose={noop}
        pollIntervalMs={20}
      />,
    );
    const calls = statusSpy.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(statusSpy.mock.calls.length).toBe(calls);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('PaymentCardBottomSheet (F8)', () => {
  it('passes the context to payWithCard and the paymentId to onSuccess', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const paySpy = jest.spyOn(wallet, 'payWithCard');
    const onSuccess = jest.fn();
    const ctx = {
      purpose: { kind: 'fura_fila' as const, merchantRef: 'm1' },
      idempotencyKey: 'chk_teste123',
    };
    const { findByText, getByText } = renderWithProviders(
      <PaymentCardBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        context={ctx}
        onSuccess={onSuccess}
        onClose={noop}
      />,
      { wallet },
    );
    await findByText('•••• 4242');
    fireEvent.press(getByText('Concluir Pagamento'));
    await waitFor(() =>
      expect(paySpy).toHaveBeenCalledWith('card_visa_1', AMOUNT, DESCRIPTION, ctx),
    );
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/^pay_mock_/)),
    );
  });
});

describe('PaymentCardBottomSheet (F8: erro da cobrança)', () => {
  it('shows the payment error message instead of failing silently', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const timeout = Object.assign(
      new Error('Ainda não confirmamos o pagamento. Tente de novo em instantes.'),
      { name: 'PaymentsApiError' },
    );
    jest.spyOn(wallet, 'payWithCard').mockRejectedValue(timeout);
    const onSuccess = jest.fn();
    const { findByText, getByText } = renderWithProviders(
      <PaymentCardBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={onSuccess}
        onClose={noop}
      />,
      { wallet },
    );
    await findByText('•••• 4242');
    await act(async () => {
      fireEvent.press(getByText('Concluir Pagamento'));
    });
    expect(await findByText(/ainda não confirmamos o pagamento/i)).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('uses a generic message for unexpected errors', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'payWithCard').mockRejectedValue(new Error('TypeError interno xyz'));
    const { findByText, getByText, queryByText } = renderWithProviders(
      <PaymentCardBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={jest.fn()}
        onClose={noop}
      />,
      { wallet },
    );
    await findByText('•••• 4242');
    await act(async () => {
      fireEvent.press(getByText('Concluir Pagamento'));
    });
    expect(await findByText('Não foi possível concluir o pagamento. Tente de novo.')).toBeTruthy();
    expect(queryByText(/xyz/)).toBeNull();
  });
});
