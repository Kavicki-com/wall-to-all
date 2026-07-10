/**
 * Testes de comportamento do formulário compartilhado de chave Pix (F3 —
 * Carteira/Financeiro, Task 6, Figma nodes 2660:6529 cliente / 2597:6009 lojista).
 *
 * O `PixKeyForm` consome `useWalletService()` (via ServicesProvider) e
 * `useToast()` (via ToastProvider), e navega com `expo-router`. Mockamos
 * `expo-router` (useRouter → mockPush/mockBack) e `react-native-safe-area-context`
 * (useSafeAreaInsets) no escopo do módulo. O serviço vem de um
 * `MockWalletService({ latencyMs: 0 })` fresco injetado via
 * `renderWithProviders(..., { wallet })`; o form é envolvido no `ToastProvider`
 * (usa toasts, que lançam fora do provider). Testamos o componente direto — mais
 * simples que os wrappers finos de rota.
 *
 * DECISÃO raw-vs-masked: o form envia a `addPixKey` o valor CRU do tipo — dígitos
 * puros (cpf/cnpj/phone), o e-mail como digitado, e a chave gerada (random). A
 * exibição no input é mascarada, mas o estado interno guarda o valor cru.
 *
 * Cobrem: (1) CPF default — valor incompleto mantém a CTA desabilitada, CPF
 * completo habilita e o submit chama `addPixKey({ type: 'cpf', value: <11 dígitos> })`
 * + `onSaved`; (2) trocar para E-mail muda a validação e salva com `type: 'email'`;
 * (3) "Aleatória" desabilita o input (o CustomInput troca o TextInput editável por
 * um Text estático, removendo o testID) e a CTA fica habilitada, salvando com
 * `type: 'random'`.
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

// O form usa useSafeAreaInsets no header "Voltar"; inset determinístico.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import { PixKeyForm } from '../components/wallet/PixKeyForm';

const mockOnSaved = jest.fn();

function renderForm(wallet: MockWalletService) {
  return renderWithProviders(
    <ToastProvider>
      <PixKeyForm onSaved={mockOnSaved} />
    </ToastProvider>,
    { wallet },
  );
}

describe('PixKeyForm (formulário compartilhado de chave Pix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('CPF (default): valor incompleto mantém a CTA desabilitada; CPF completo habilita e salva', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const addPixKeySpy = jest.spyOn(wallet, 'addPixKey');
    const { getByTestId } = renderForm(wallet);

    // Valor incompleto ("123") → CTA desabilitada.
    fireEvent.changeText(getByTestId('input-pix-value'), '123');
    expect(getByTestId('btn-save-pix').props.accessibilityState.disabled).toBe(true);

    // CPF completo (11 dígitos) → CTA habilitada.
    fireEvent.changeText(getByTestId('input-pix-value'), '12345678912');
    expect(getByTestId('btn-save-pix').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('btn-save-pix'));

    // Envia os dígitos CRUS (a exibição é mascarada, mas o estado é cru).
    await waitFor(() => {
      expect(addPixKeySpy).toHaveBeenCalledWith({ type: 'cpf', value: '12345678912' });
    });
    await waitFor(() => expect(mockOnSaved).toHaveBeenCalled());
  });

  it('trocar para "E-mail" muda a validação: e-mail válido habilita a CTA e salva com type email', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const addPixKeySpy = jest.spyOn(wallet, 'addPixKey');
    const { getByTestId, getByText } = renderForm(wallet);

    fireEvent.press(getByText('E-mail'));

    // E-mail válido habilita a CTA (a validação agora é regex de e-mail, não 11 dígitos).
    fireEvent.changeText(getByTestId('input-pix-value'), 'maria@email.com');
    expect(getByTestId('btn-save-pix').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('btn-save-pix'));

    await waitFor(() => {
      expect(addPixKeySpy).toHaveBeenCalledWith({ type: 'email', value: 'maria@email.com' });
    });
    await waitFor(() => expect(mockOnSaved).toHaveBeenCalled());
  });

  it('"Aleatória" desabilita o input e a CTA fica habilitada; salva com type random', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const addPixKeySpy = jest.spyOn(wallet, 'addPixKey');
    const { getByTestId, queryByTestId, getByText } = renderForm(wallet);

    fireEvent.press(getByText('Aleatória'));

    // Input desabilitado → o CustomInput troca o TextInput editável por um Text
    // estático (sem o testID), logo o input editável some da árvore.
    expect(queryByTestId('input-pix-value')).toBeNull();

    // Random é sempre válida → CTA habilitada mesmo sem digitação.
    expect(getByTestId('btn-save-pix').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('btn-save-pix'));

    // Valor é a chave gerada (não determinística) — asserimos só o tipo.
    await waitFor(() => {
      expect(addPixKeySpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'random' }));
    });
    await waitFor(() => expect(mockOnSaved).toHaveBeenCalled());
  });
});
