/**
 * Testes de comportamento do `WithdrawFlow` (F4 — QI, Task 4; Figma 🆕 2715:3711).
 *
 * O componente é agnóstico de domínio: recebe `quote`/`onConfirm`/`onAddPixKey`/
 * `onSuccessClose` por props — aqui tudo é `jest.fn()` (latência 0), SEM
 * serviços nem `renderWithProviders`. Só envolvemos no `ToastProvider` porque o
 * componente usa `useToast()` no erro de confirmação (provider de ambiente).
 *
 * A cotação fake delega ao helper puro `computeWithdrawQuote` (a régua real:
 * taxa R$ 5,00 abaixo de R$ 200,00; isento a partir daí) para as asserções de
 * taxa/total espelharem a regra compartilhada.
 *
 * Obs.: strings BRL usam espaço NÃO-quebrável — as asserções de valor casam por
 * REGEX nos dígitos ("95,00"), nunca pela string literal.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ToastProvider } from '../components/ui/ToastProvider';
import { WithdrawFlow, WithdrawFlowProps } from '../components/wallet/WithdrawFlow';
import { computeWithdrawQuote } from '../lib/services/mock/withdrawQuote';
import type { PixKey } from '../lib/services/types';

// Chaves Pix fake (já mascaradas, como o domínio garante por construção).
const PIX_KEYS: PixKey[] = [
  { id: 'key-cpf', type: 'cpf', maskedValue: '*********-12', createdAt: '2026-01-01T12:00:00.000Z' },
  { id: 'key-email', type: 'email', maskedValue: 'd***@k***.com', createdAt: '2026-02-01T12:00:00.000Z' },
];

// Monta o componente com props default sobrescrevíveis; retorna o RTL + props
// (os jest.fn) para asserções diretas.
function setup(overrides: Partial<WithdrawFlowProps> = {}) {
  const props: WithdrawFlowProps = {
    heroLabel: 'Saldo disponível',
    balanceCents: 30000, // R$ 300,00
    pixKeys: PIX_KEYS,
    quote: jest.fn(async (amountCents: number) => computeWithdrawQuote(amountCents)),
    onConfirm: jest.fn(async () => undefined),
    onAddPixKey: jest.fn(),
    onSuccessClose: jest.fn(),
    ...overrides,
  };
  const utils = render(
    <ToastProvider>
      <WithdrawFlow {...props} />
    </ToastProvider>,
  );
  return { ...utils, props };
}

describe('WithdrawFlow (componente compartilhado de saque)', () => {
  it('mostra o rótulo do hero e o saldo formatado', () => {
    const { getByText, getByTestId } = setup({ heroLabel: 'Saldo Cashback' });

    expect(getByText('Saldo Cashback')).toBeTruthy();
    expect(getByTestId('withdraw-balance').props.children).toMatch(/300,00/);
  });

  it('resumo só aparece com valor > 0; abaixo do teto mostra taxa R$ 5,00 e total líquido', async () => {
    const { queryByText, findByText, getByTestId, props } = setup();

    // Sem valor digitado → sem resumo.
    expect(queryByText('Resumo da transferência')).toBeNull();

    // R$ 100,00 (abaixo do teto de isenção de R$ 200,00) → taxa R$ 5,00.
    fireEvent.changeText(getByTestId('input-amount'), '10000');

    expect(await findByText('Resumo da transferência')).toBeTruthy();
    expect(props.quote).toHaveBeenCalledWith(10000);
    expect(getByTestId('summary-amount').props.children).toMatch(/100,00/);
    expect(getByTestId('summary-fee').props.children).toMatch(/5,00/);
    expect(getByTestId('summary-eta').props.children).toBe('Até 24 horas');
    expect(getByTestId('summary-total').props.children).toMatch(/95,00/);
  });

  it('a partir de R$ 200,00 a taxa é R$ 0,00 e o total é o valor cheio', async () => {
    const { findByText, getByTestId } = setup();

    fireEvent.changeText(getByTestId('input-amount'), '20000');

    expect(await findByText('Resumo da transferência')).toBeTruthy();
    expect(getByTestId('summary-fee').props.children).toMatch(/0,00/);
    expect(getByTestId('summary-total').props.children).toMatch(/200,00/);
  });

  it('com minWithdrawCents: valor abaixo do mínimo desabilita a CTA; no mínimo habilita', () => {
    const { getByTestId } = setup({ minWithdrawCents: 3000 });

    fireEvent.press(getByTestId('pix-option-key-cpf'));
    fireEvent.changeText(getByTestId('input-amount'), '2000'); // R$ 20,00 < R$ 30,00

    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(getByTestId('input-amount'), '3000'); // exatamente o mínimo

    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(false);
  });

  it('sem minWithdrawCents: qualquer valor > 0 (com chave selecionada) habilita a CTA', () => {
    const { getByTestId } = setup();

    fireEvent.press(getByTestId('pix-option-key-cpf'));
    fireEvent.changeText(getByTestId('input-amount'), '100'); // R$ 1,00

    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(false);
  });

  it('CTA desabilitada com valor 0, acima do saldo ou sem chave selecionada', () => {
    const { getByTestId } = setup();

    // Valor 0 → desabilitada.
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);

    // Valor válido mas SEM chave → continua desabilitada.
    fireEvent.changeText(getByTestId('input-amount'), '10000');
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);

    // Acima do saldo (R$ 999,99 > R$ 300,00), mesmo com chave → desabilitada.
    fireEvent.press(getByTestId('pix-option-key-cpf'));
    fireEvent.changeText(getByTestId('input-amount'), '99999');
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);
  });

  it('chip "Tudo" preenche o valor com o saldo inteiro', async () => {
    const { getByTestId, findByText, props } = setup();

    fireEvent.press(getByTestId('quick-amount-all'));

    expect(getByTestId('input-amount').props.value).toMatch(/300,00/);
    expect(await findByText('Resumo da transferência')).toBeTruthy();
    expect(props.quote).toHaveBeenCalledWith(30000);
    expect(getByTestId('summary-amount').props.children).toMatch(/300,00/);
  });

  it('fluxo feliz: overlay de loading → onConfirm(valor, chave) → modal → onSuccessClose', async () => {
    // Promise controlada para observarmos o overlay ENQUANTO o submit está em voo.
    let resolveConfirm!: () => void;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const { getByTestId, findByTestId, findByText, props } = setup({ onConfirm });

    fireEvent.changeText(getByTestId('input-amount'), '10000');
    fireEvent.press(getByTestId('pix-option-key-cpf'));
    fireEvent.press(getByTestId('btn-confirm-withdraw'));

    // Overlay de loading visível enquanto o onConfirm não resolve.
    expect(await findByTestId('withdraw-loading')).toBeTruthy();
    expect(onConfirm).toHaveBeenCalledWith(10000, 'key-cpf');

    resolveConfirm();

    // Modal de sucesso; "Concluir" delega o fechamento ao chamador.
    expect(await findByText('Saque solicitado')).toBeTruthy();
    fireEvent.press(getByTestId('btn-withdraw-done'));
    await waitFor(() => expect(props.onSuccessClose).toHaveBeenCalled());
  });

  it('rejeição do onConfirm → toast de erro, sem modal, formulário reexibido', async () => {
    const onConfirm = jest.fn().mockRejectedValueOnce(new Error('falhou'));
    const { getByTestId, findByText, queryByText, queryByTestId } = setup({ onConfirm });

    fireEvent.changeText(getByTestId('input-amount'), '10000');
    fireEvent.press(getByTestId('pix-option-key-cpf'));
    fireEvent.press(getByTestId('btn-confirm-withdraw'));

    // Toast de erro (cópia fixa do componente).
    expect(await findByText('Não foi possível solicitar o saque. Tente novamente.')).toBeTruthy();
    // Sem modal de sucesso; formulário de volta (overlay sumiu, CTA reabilitada).
    expect(queryByText('Saque solicitado')).toBeNull();
    expect(queryByTestId('withdraw-loading')).toBeNull();
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(false);
  });

  it('sem chaves Pix → empty state com CTA que chama onAddPixKey; confirmar continua bloqueado', () => {
    const { getByText, getByTestId, props } = setup({ pixKeys: [] });

    expect(
      getByText('Você ainda não cadastrou uma chave Pix para receber o saque.'),
    ).toBeTruthy();

    // Mesmo com valor válido, sem chave a CTA não habilita.
    fireEvent.changeText(getByTestId('input-amount'), '10000');
    expect(getByTestId('btn-confirm-withdraw').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByTestId('btn-add-pix'));
    expect(props.onAddPixKey).toHaveBeenCalled();
  });

  it('botão "+ Adicionar chave Pix" chama onAddPixKey também com chaves presentes', () => {
    const { getByTestId, props } = setup();

    fireEvent.press(getByTestId('btn-add-pix'));

    expect(props.onAddPixKey).toHaveBeenCalled();
  });
});
