/**
 * Testes de comportamento do cadastro de cartão do cliente (F3 — Carteira/
 * Financeiro, Task 5, Figma node 2660:6604).
 *
 * A tela consome `useWalletService()` (via ServicesProvider) e `useToast()` (via
 * ToastProvider), e navega com `expo-router`. Mockamos `expo-router` (useRouter →
 * mockPush/mockBack) e `react-native-safe-area-context` (useSafeAreaInsets) no
 * escopo do módulo. O serviço vem de um `MockWalletService({ latencyMs: 0 })`
 * fresco injetado via `renderWithProviders(..., { wallet })`; a tela é envolvida
 * no `ToastProvider` (a tela usa toasts, que lançam fora do provider).
 *
 * Cobrem: CTA desabilitada com formulário inválido/vazio; preenchimento válido
 * habilita a CTA e o submit chama `addCard` (com os dígitos crus + validade
 * `MM/AA`) e depois `router.back()`; validade vencida mantém a CTA desabilitada.
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

// A tela usa useSafeAreaInsets no header; inset determinístico (igual às demais).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import NewCardScreen from '../app/(client)/wallet/new-card';

// Validade futura computada do ano atual + 10 (evita o teste "apodrecer").
const FUTURE_YY = String((new Date().getFullYear() + 10) % 100).padStart(2, '0');
const FUTURE_EXPIRY = `12/${FUTURE_YY}`;

function renderScreen(wallet: MockWalletService) {
  return renderWithProviders(
    <ToastProvider>
      <NewCardScreen />
    </ToastProvider>,
    { wallet },
  );
}

describe('NewCardScreen (cadastro de cartão do cliente)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('com o formulário vazio/inválido, a CTA "Salvar cartão" fica desabilitada', () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { getByTestId } = renderScreen(wallet);

    expect(getByTestId('btn-save-card').props.accessibilityState.disabled).toBe(true);
  });

  it('preenchendo tudo validamente habilita a CTA; ao pressionar, chama addCard e volta', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const addCardSpy = jest.spyOn(wallet, 'addCard');
    const { getByTestId } = renderScreen(wallet);

    fireEvent.changeText(getByTestId('input-number'), '4111 1111 1111 1111');
    fireEvent.changeText(getByTestId('input-holder'), 'MARIA SILVA');
    fireEvent.changeText(getByTestId('input-expiry'), FUTURE_EXPIRY);
    fireEvent.changeText(getByTestId('input-cvv'), '123');

    // Formulário válido → CTA habilitada.
    expect(getByTestId('btn-save-card').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('btn-save-card'));

    await waitFor(() => {
      expect(addCardSpy).toHaveBeenCalledWith({
        number: '4111111111111111',
        holderName: 'MARIA SILVA',
        expiry: FUTURE_EXPIRY,
        cvv: '123',
      });
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('validade vencida mantém a CTA desabilitada', () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { getByTestId } = renderScreen(wallet);

    fireEvent.changeText(getByTestId('input-number'), '4111 1111 1111 1111');
    fireEvent.changeText(getByTestId('input-holder'), 'MARIA SILVA');
    fireEvent.changeText(getByTestId('input-cvv'), '123');
    // Validade no passado (jan/2020) → "Cartão vencido".
    fireEvent.changeText(getByTestId('input-expiry'), '01/20');

    expect(getByTestId('btn-save-card').props.accessibilityState.disabled).toBe(true);
  });
});
