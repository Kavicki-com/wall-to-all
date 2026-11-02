/**
 * Aviso "Ative seus recebimentos" do lojista (F8, Task 15).
 *
 * O banner some com a conta `active`; com `pending`/`none` abre o formulário
 * hospedado (`startPayoutOnboarding` + `WebBrowser.openAuthSessionAsync`) e, na
 * volta, pede ao pai para recarregar o status (`onReturn`).
 */
import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { renderWithProviders } from './test-utils';
import { MockWalletService } from '../lib/services/mock/mockWalletService';
import { PayoutOnboardingBanner } from '../components/wallet/PayoutOnboardingBanner';

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

const mockOpen = WebBrowser.openAuthSessionAsync as jest.Mock;

async function renderBanner(
  status: 'active' | 'pending' | 'none',
  wallet = new MockWalletService({ latencyMs: 0 }),
  onReturn = jest.fn(),
) {
  const utils = renderWithProviders(
    <PayoutOnboardingBanner status={status} onReturn={onReturn} />,
    { wallet },
  );
  // O Icon (@expo/vector-icons) carrega a fonte de forma assíncrona.
  await act(async () => {});
  return { ...utils, wallet, onReturn };
}

describe('PayoutOnboardingBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpen.mockResolvedValue({ type: 'success', url: 'walltoall://financeiro?onboarding=done' });
  });

  it('conta ativa: nada é renderizado', async () => {
    const { queryByTestId, queryByText } = await renderBanner('active');
    expect(queryByTestId('payout-banner')).toBeNull();
    expect(queryByText('Ative seus recebimentos')).toBeNull();
  });

  it.each(['pending', 'none'] as const)('conta %s: mostra o aviso e o CTA', async (status) => {
    const { getByText, getByTestId } = await renderBanner(status);
    expect(getByText('Ative seus recebimentos')).toBeTruthy();
    expect(getByTestId('btn-activate-payouts')).toBeTruthy();
    expect(getByText('Ativar recebimentos')).toBeTruthy();
  });

  it('CTA: abre o formulário com o retorno do app e recarrega o status na volta', async () => {
    const wallet = new MockWalletService({ latencyMs: 0, payoutStatus: 'pending' });
    const start = jest.spyOn(wallet, 'startPayoutOnboarding');
    const { getByTestId, onReturn } = await renderBanner('pending', wallet);

    await act(async () => fireEvent.press(getByTestId('btn-activate-payouts')));

    expect(start).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledWith(
      'https://connect.stripe.com/setup/mock',
      'walltoall://financeiro',
    );
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('fechar o navegador sem concluir também recarrega (o lojista pode ter avançado)', async () => {
    mockOpen.mockResolvedValue({ type: 'cancel' });
    const { getByTestId, onReturn } = await renderBanner('none');

    await act(async () => fireEvent.press(getByTestId('btn-activate-payouts')));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('falha ao gerar o link: mensagem inline, sem abrir o navegador', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'startPayoutOnboarding').mockRejectedValue(new Error('rede'));
    const { getByTestId, findByText, onReturn } = await renderBanner('pending', wallet);

    await act(async () => fireEvent.press(getByTestId('btn-activate-payouts')));

    expect(await findByText('Não foi possível abrir a ativação. Tente novamente.')).toBeTruthy();
    expect(mockOpen).not.toHaveBeenCalled();
    expect(onReturn).not.toHaveBeenCalled();
  });

  it('duplo toque abre o formulário uma vez só', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const start = jest.spyOn(wallet, 'startPayoutOnboarding');
    const { getByTestId } = await renderBanner('pending', wallet);

    await act(async () => {
      fireEvent.press(getByTestId('btn-activate-payouts'));
      fireEvent.press(getByTestId('btn-activate-payouts'));
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});
