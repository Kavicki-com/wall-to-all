/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
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
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockWalletService } from '../lib/services/mock/mockWalletService';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    // useFocusEffect fiel ao runtime: executa como EFEITO (dispara o load no
    // foco/mount e só re-executa quando o callback memoizado muda), honrando o
    // cleanup. Rodar `cb()` direto no corpo do render re-disparava a carga a
    // cada render (laço carga → render → carga) e enchia a saída de avisos de
    // act().
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

// A tela usa useSafeAreaInsets no header "Voltar"; inset determinístico.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

// F8: o estado bloqueado tem o CTA de ativação (formulário hospedado).
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
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

  it('CTA desabilitada com valor 0; com chave selecionada mas valor acima do saldo continua desabilitada', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const [cpfKey] = await wallet.getPixKeys();
    const { findByTestId, getByTestId } = renderScreen(wallet);

    // Sem valor digitado (0) → CTA desabilitada.
    const cta = await findByTestId('btn-confirm-withdraw');
    expect(cta.props.accessibilityState.disabled).toBe(true);

    // Seleciona a chave Pix ANTES para isolar a guarda de saldo (sem isso a CTA
    // já estaria desabilitada pela regra "sem chave", mascarando a de saldo).
    fireEvent.press(getByTestId(`pix-option-${cpfKey.id}`));
    // Valor MUITO acima do saldo (9999999 centavos = R$ 99.999,99 > R$ 591,20).
    fireEvent.changeText(getByTestId('input-amount'), '9999999');

    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);
    // A cotação do valor digitado resolve depois: drena dentro de act.
    await act(async () => {});
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
      expect(withdrawSpy).toHaveBeenCalledWith(10000, cpfKey.id, expect.stringMatching(/^chk_/)),
    );

    // Modal de sucesso aparece.
    expect(await findByText('Saque solicitado')).toBeTruthy();

    // Fechar o modal volta para a tela anterior.
    fireEvent.press(getByTestId('btn-withdraw-done'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('valor válido → exibe o resumo da transferência com taxa de operação e total', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, findByText, getByTestId } = renderScreen(wallet);

    // Valor abaixo de R$ 200,00 (10000 centavos = R$ 100,00) → taxa de R$ 5,00.
    fireEvent.changeText(await findByTestId('input-amount'), '10000');

    // A cotação resolve async (latencyMs 0 → microtask); aguarda o resumo.
    expect(await findByText('Taxa de operação')).toBeTruthy();
    // Taxa R$ 5,00 e total líquido R$ 95,00 (BRL usa espaço não-quebrável →
    // casamos por REGEX nos dígitos, nunca pela string literal).
    expect(getByTestId('summary-fee').props.children).toMatch(/5,00/);
    expect(getByTestId('summary-total').props.children).toMatch(/95,00/);
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

  describe('F8: carga resiliente, conta inativa e idempotência', () => {
    it('carga falhando: mensagem de erro, "Tentar novamente" recarrega e "Voltar" presente', async () => {
      const wallet = new MockWalletService({ latencyMs: 0 });
      const balanceSpy = jest
        .spyOn(wallet, 'getMerchantBalanceCents')
        .mockRejectedValueOnce(new Error('rede'));
      const { findByText, getByTestId, findByTestId, queryByTestId } = renderScreen(wallet);

      expect(await findByText('Não foi possível carregar os dados do saque.')).toBeTruthy();
      expect(getByTestId('btn-back')).toBeTruthy();
      expect(queryByTestId('btn-confirm-withdraw')).toBeNull();

      await act(async () => fireEvent.press(getByTestId('btn-retry')));

      expect(await findByTestId('btn-confirm-withdraw')).toBeTruthy();
      expect(balanceSpy).toHaveBeenCalledTimes(2);
    });

    it('"Voltar" do estado de erro sai da tela', async () => {
      const wallet = new MockWalletService({ latencyMs: 0 });
      jest.spyOn(wallet, 'getPixKeys').mockRejectedValue(new Error('rede'));
      const { findByText, getByTestId } = renderScreen(wallet);

      await findByText('Não foi possível carregar os dados do saque.');
      fireEvent.press(getByTestId('btn-back'));
      expect(mockBack).toHaveBeenCalled();
    });

    it.each(['pending', 'none'] as const)(
      'conta %s: formulário bloqueado e CTA de ativação',
      async (payoutStatus) => {
        const wallet = new MockWalletService({ latencyMs: 0, payoutStatus });
        const { findByText, getByTestId, queryByTestId } = renderScreen(wallet);

        expect(await findByText('Ative seus recebimentos')).toBeTruthy();
        expect(getByTestId('btn-activate-payouts')).toBeTruthy();
        expect(queryByTestId('btn-confirm-withdraw')).toBeNull();
        expect(getByTestId('btn-back')).toBeTruthy();
      },
    );

    it('retry depois de falha reusa a chave de idempotência', async () => {
      const wallet = new MockWalletService({ latencyMs: 0 });
      const [cpfKey] = await wallet.getPixKeys();
      const spy = jest.spyOn(wallet, 'requestWithdraw').mockRejectedValueOnce(new Error('rede'));
      const { findByTestId, getByTestId, findByText } = renderScreen(wallet);

      fireEvent.changeText(await findByTestId('input-amount'), '10000');
      fireEvent.press(getByTestId(`pix-option-${cpfKey.id}`));
      await act(async () => fireEvent.press(getByTestId('btn-confirm-withdraw')));
      await findByText('Não foi possível solicitar o saque. Tente novamente.');

      await act(async () => fireEvent.press(getByTestId('btn-confirm-withdraw')));
      await findByText('Saque solicitado');

      expect(spy).toHaveBeenCalledTimes(2);
      const firstKey = spy.mock.calls[0][2];
      expect(firstKey).toMatch(/^chk_/);
      expect(spy.mock.calls[1][2]).toBe(firstKey);
    });

    it('mudar o valor depois de uma falha gera chave nova', async () => {
      const wallet = new MockWalletService({ latencyMs: 0 });
      const [cpfKey] = await wallet.getPixKeys();
      const spy = jest.spyOn(wallet, 'requestWithdraw').mockRejectedValueOnce(new Error('rede'));
      const { findByTestId, getByTestId, findByText } = renderScreen(wallet);

      fireEvent.changeText(await findByTestId('input-amount'), '10000');
      fireEvent.press(getByTestId(`pix-option-${cpfKey.id}`));
      await act(async () => fireEvent.press(getByTestId('btn-confirm-withdraw')));
      await findByText('Não foi possível solicitar o saque. Tente novamente.');

      fireEvent.changeText(getByTestId('input-amount'), '20000');
      await act(async () => fireEvent.press(getByTestId('btn-confirm-withdraw')));

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][2]).not.toBe(spy.mock.calls[0][2]);
    });
  });
});
