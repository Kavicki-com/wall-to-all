/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
/**
 * Testes de comportamento do SAQUE DO QI (F4 — Task 12; Figma 🆕 2715:3711, node
 * do QI 2628:6373, loading 2628:7300/2628:6464, modal 2628:7299/2628:6463).
 *
 * Cobrem o lado CLIENTE (`app/(client)/qi/withdraw.tsx`). O lado LOJISTA
 * (`app/(merchant)/qi/withdraw.tsx`) é o MESMO wrapper espelhado: mesma carga
 * (resumo + regras + chaves Pix), mesmo `WithdrawFlow`, mesmos testIDs; só mudam
 * o `side` passado ao QiService e o grupo de rotas do "+ Adicionar chave Pix".
 * Por isso não há suíte duplicada aqui — o que difere entre os lados é dado de
 * fixture (saldo R$ 74,09 no cliente, R$ 89,09 no lojista), já coberto pelos
 * testes do MockQiService.
 *
 * A tela consome `useQiService()` + `useWalletService()` (via ServicesProvider),
 * `useToast()` (via ToastProvider) e navega com `expo-router`. Mockamos, no
 * escopo do módulo: `expo-router` (useRouter → mockPush/mockBack; useFocusEffect
 * como efeito) e `react-native-safe-area-context` (useSafeAreaInsets, usado pelo
 * header "Voltar"). Serviços frescos com latência 0 são injetados via
 * `renderWithProviders(..., { qi, wallet })`.
 *
 * Obs.: strings BRL usam espaço não-quebrável em alguns formatadores — as
 * asserções de valor casam por REGEX nos dígitos ("74,09"), nunca pela string
 * literal inteira.
 */
import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockQiService } from '../lib/services/mock/mockQiService';
import { MockWalletService } from '../lib/services/mock/mockWalletService';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    // Métodos que DELEGAM para os spies: montar `{ push: mockPush }` direto na
    // fábrica cairia na zona morta temporal do hoisting do jest.mock.
    useRouter: () => ({
      push: (...args: unknown[]) => mockPush(...args),
      back: (...args: unknown[]) => mockBack(...args),
    }),
    // useFocusEffect fiel ao runtime: executa como EFEITO (dispara o load no
    // foco/mount e só re-executa quando o callback memoizado muda), honrando o
    // cleanup.
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

// A tela usa useSafeAreaInsets no header "Voltar"; inset determinístico.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

// O catch da carga chama `handleError`, que loga via `logger.error`. Silenciamos
// para o ramo de erro não sujar a saída (mesmo padrão das demais suítes).
jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import ClientQiWithdrawScreen from '../app/(client)/qi/withdraw';

/** Chave Pix única da fixture do MockWalletService. */
const PIX_KEY_ID = 'pix_cpf_1';

/**
 * Digita um valor e AGUARDA a cotação assíncrona que o `WithdrawFlow` dispara a
 * cada valor > 0 assentar. Sem esse flush, o `setQuoteResult` da cotação cairia
 * fora do `act()` do evento e o React avisaria "not wrapped in act(...)" nos
 * casos cuja asserção é síncrona (CTA habilitada/desabilitada).
 */
async function typeAmount(input: Parameters<typeof fireEvent.changeText>[0], cents: string) {
  fireEvent.changeText(input, cents);
  await act(async () => {});
}

function renderScreen(qi: MockQiService, wallet: MockWalletService) {
  return renderWithProviders(
    <ToastProvider>
      <ClientQiWithdrawScreen />
    </ToastProvider>,
    { qi, wallet },
  );
}

describe('Saque do QI (cliente)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mostra o saldo do QI (R$ 74,09) no hero, não o saldo da carteira', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId } = renderScreen(qi, wallet);

    const balance = await findByTestId('withdraw-balance');
    expect(balance.props.children).toMatch(/74,09/);
  });

  it('valor abaixo do mínimo do programa mantém a CTA desabilitada; no mínimo, habilita', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { minWithdrawCents } = await qi.getProgramRules();
    const { findByTestId, getByTestId } = renderScreen(qi, wallet);

    // Seleciona a chave ANTES para isolar a guarda do mínimo (sem isso a CTA já
    // estaria desabilitada pela regra "sem chave", mascarando a que se testa).
    fireEvent.press(await findByTestId(`pix-option-${PIX_KEY_ID}`));

    // Um centavo abaixo do mínimo DAS REGRAS → CTA desabilitada.
    await typeAmount(getByTestId('input-amount'), String(minWithdrawCents - 1));
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);

    // Exatamente o mínimo → CTA habilitada.
    await typeAmount(getByTestId('input-amount'), String(minWithdrawCents));
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(false);
  });

  it('fluxo feliz: chama requestQiWithdraw, abre o modal, volta ao fechar e debita o saldo do QI', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const wallet = new MockWalletService({ latencyMs: 0 });
    const withdrawSpy = jest.spyOn(qi, 'requestQiWithdraw');
    const { findByTestId, getByTestId, findByText } = renderScreen(qi, wallet);

    // R$ 50,00 (5000 centavos): acima do mínimo e dentro do saldo de R$ 74,09.
    fireEvent.press(await findByTestId(`pix-option-${PIX_KEY_ID}`));
    await typeAmount(getByTestId('input-amount'), '5000');
    fireEvent.press(getByTestId('btn-confirm-withdraw'));

    // O lado ('client') é injetado pelo wrapper — é o que esta rota existe para fazer.
    await waitFor(() => expect(withdrawSpy).toHaveBeenCalledWith('client', 5000, PIX_KEY_ID));

    expect(await findByText('Saque solicitado')).toBeTruthy();

    // Fechar o modal volta para a tela anterior.
    fireEvent.press(getByTestId('btn-withdraw-done'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    // O saque debitou o saldo do QI do CLIENTE no serviço (7409 − 5000 = 2409).
    const summary = await qi.getQiSummary('client');
    expect(summary.balanceCents).toBe(2409);
  });

  it('sem chave Pix cadastrada: CTA desabilitada e "+ Adicionar chave Pix" leva ao cadastro do QI', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(wallet, 'getPixKeys').mockResolvedValue([]);
    const { findByTestId, getByTestId } = renderScreen(qi, wallet);

    // Mesmo com valor válido, sem chave a CTA continua desabilitada.
    await typeAmount(await findByTestId('input-amount'), '5000');
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByTestId('btn-add-pix'));
    expect(mockPush).toHaveBeenCalledWith('/(client)/qi/new-pix-key');
  });

  it('falha da carga inicial mostra erro com "Tentar novamente" e o "Voltar", nunca spinner infinito', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const wallet = new MockWalletService({ latencyMs: 0 });
    jest.spyOn(qi, 'getQiSummary').mockRejectedValueOnce(new Error('falhou'));
    const { findByTestId, getByTestId, queryByTestId } = renderScreen(qi, wallet);

    expect(await findByTestId('btn-retry')).toBeTruthy();
    expect(getByTestId('btn-back')).toBeTruthy();
    expect(queryByTestId('withdraw-balance')).toBeNull();

    // O retry refaz a carga e a tela chega ao formulário com o saldo do QI.
    fireEvent.press(getByTestId('btn-retry'));
    const balance = await findByTestId('withdraw-balance');
    expect(balance.props.children).toMatch(/74,09/);
  });
});
