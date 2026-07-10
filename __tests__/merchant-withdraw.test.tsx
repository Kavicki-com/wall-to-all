/**
 * Testes de comportamento do saque do LOJISTA (F3 — Carteira/Financeiro, Task 9,
 * Figma nodes 2715:3711 saque, 2622:5836 loading, 2622:5847 modal de sucesso).
 *
 * A tela consome `useWalletService()` (via ServicesProvider) e `useToast()` (via
 * ToastProvider), e navega com `expo-router`. Mockamos, no escopo do módulo:
 * `expo-router` (useRouter → mockPush/mockBack) e `react-native-safe-area-context`
 * (useSafeAreaInsets, usado pelo header "Voltar"). O serviço vem de um
 * `MockWalletService({ latencyMs: 0 })` fresco injetado via
 * `renderWithProviders(..., { wallet })`; a tela é envolvida no `ToastProvider`
 * (a tela usa toasts, que lançam fora do provider).
 *
 * Obs.: strings BRL usam espaço NÃO-quebrável — as asserções de valor casam por
 * REGEX nos dígitos ("100,00"), nunca pela string literal.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockWalletService } from '../lib/services/mock/mockWalletService';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

// A tela usa useSafeAreaInsets no header "Voltar"; inset determinístico.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import WithdrawScreen from '../app/(merchant)/financeiro/withdraw';

function renderScreen(wallet: MockWalletService) {
  return renderWithProviders(
    <ToastProvider>
      <WithdrawScreen />
    </ToastProvider>,
    { wallet },
  );
}

describe('WithdrawScreen (solicitar saque do lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('CTA desabilitada com valor 0; com valor acima do saldo continua desabilitada', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderScreen(wallet);

    // Sem valor digitado (0) → CTA desabilitada.
    const cta = await findByTestId('btn-confirm-withdraw');
    expect(cta.props.accessibilityState.disabled).toBe(true);

    // Valor MUITO acima do saldo (9999999 centavos = R$ 99.999,99 > R$ 591,20).
    fireEvent.changeText(getByTestId('input-amount'), '9999999');

    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);
  });

  it('valor válido + chave selecionada → chama requestWithdraw e mostra o modal de sucesso; ao fechar, volta', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const [cpfKey] = await wallet.getPixKeys();
    const withdrawSpy = jest.spyOn(wallet, 'requestWithdraw');
    const { findByTestId, getByTestId, findByText } = renderScreen(wallet);

    // Valor válido: 10000 centavos = R$ 100,00 (≤ saldo 59120).
    fireEvent.changeText(await findByTestId('input-amount'), '10000');
    // Seleciona a chave Pix (CPF) do mock.
    fireEvent.press(getByTestId(`pix-option-${cpfKey.id}`));

    // CTA habilitada com valor válido + chave selecionada.
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('btn-confirm-withdraw'));

    await waitFor(() =>
      expect(withdrawSpy).toHaveBeenCalledWith(10000, cpfKey.id),
    );

    // Modal de sucesso aparece.
    expect(await findByText('Saque solicitado')).toBeTruthy();

    // Fechar o modal volta para a tela anterior.
    fireEvent.press(getByTestId('btn-withdraw-done'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('falha do serviço → mostra toast de erro e NÃO abre o modal de sucesso', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const [cpfKey] = await wallet.getPixKeys();
    jest.spyOn(wallet, 'requestWithdraw').mockRejectedValueOnce(new Error('falhou'));
    const { findByTestId, getByTestId, findByText, queryByText } = renderScreen(wallet);

    fireEvent.changeText(await findByTestId('input-amount'), '10000');
    fireEvent.press(getByTestId(`pix-option-${cpfKey.id}`));
    fireEvent.press(getByTestId('btn-confirm-withdraw'));

    // Toast de erro (cópia fixa da tela).
    expect(await findByText('Não foi possível solicitar o saque. Tente novamente.')).toBeTruthy();
    // Sem modal de sucesso.
    expect(queryByText('Saque solicitado')).toBeNull();
  });
});
