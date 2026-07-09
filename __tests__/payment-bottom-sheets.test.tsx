import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockWalletService } from '../lib/services/mock/mockWalletService';
import { PaymentPixBottomSheet } from '../components/payment/PaymentPixBottomSheet';
import { PaymentCardBottomSheet } from '../components/payment/PaymentCardBottomSheet';
import type { PixCharge } from '../lib/services/types';
import * as Clipboard from 'expo-clipboard';

// A área de transferência é nativa: mockamos apenas o método usado. O teste
// espia `setStringAsync` para provar que "Copiar código PIX" copia o payload.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

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

    await waitFor(() => expect(chargeSpy).toHaveBeenCalledWith(AMOUNT, DESCRIPTION));
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

  it('triggers onSuccess when the confirm action is pressed', async () => {
    const onSuccess = jest.fn();
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'createPixCharge').mockResolvedValue(PIX_CHARGE);

    const { findByText } = renderWithProviders(
      <PaymentPixBottomSheet
        visible
        amountCents={AMOUNT}
        description={DESCRIPTION}
        onSuccess={onSuccess}
        onClose={noop}
      />,
      { wallet },
    );

    fireEvent.press(await findByText('Já realizei o pagamento'));
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
    await waitFor(() => expect(paySpy).toHaveBeenCalledWith('card_visa_1', AMOUNT, DESCRIPTION));
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
      expect(paySpy).toHaveBeenCalledWith('card_mastercard_1', AMOUNT, DESCRIPTION),
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
