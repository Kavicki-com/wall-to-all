/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
/**
 * Testes de comportamento do Financeiro do LOJISTA (F3 — Carteira/Financeiro,
 * Task 8, Figma nodes 2602:5991 completo e 2597:5956 vazio).
 *
 * A tela consome `useWalletService()` (via ServicesProvider) e navega com
 * `expo-router`. Mockamos, no escopo do módulo: `expo-router` (useRouter →
 * mockPush/mockBack; useFocusEffect roda o callback UMA vez → dispara o load no
 * foco/mount), `react-native-safe-area-context` (só useSafeAreaInsets, usado pela
 * HomeTopBar), o `NotificationContext` (a top bar do lojista tem sino) e o
 * `NotificationModal` (stub leve). O serviço vem de um `MockWalletService({
 * latencyMs: 0 })` fresco injetado via `renderWithProviders(..., { wallet })`.
 *
 * Obs.: strings BRL usam espaço NÃO-quebrável — a asserção de saldo casa por
 * REGEX nos dígitos ("591,20"), nunca pela string literal.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockWalletService } from '../lib/services/mock/mockWalletService';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  // useFocusEffect roda o callback uma vez → dispara o load no mount/foco.
  useFocusEffect: (cb: () => void) => cb(),
}));

// HomeTopBar usa useSafeAreaInsets; inset determinístico (igual às demais telas).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

// A top bar do lojista tem sino → a tela consome useNotifications.
const mockRefreshNotifications = jest.fn();
jest.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ unreadCount: 0, refreshNotifications: mockRefreshNotifications }),
}));

// Stub leve do NotificationModal: expõe apenas se está visível.
jest.mock('../components/notifications/NotificationModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) =>
      visible ? React.createElement(View, { testID: 'notif-modal' }) : null,
  };
});

import MerchantFinanceiroScreen from '../app/(merchant)/financeiro/index';

describe('MerchantFinanceiroScreen (financeiro do lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('após o load, exibe o saldo disponível formatado (R$ 591,20)', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByText } = renderWithProviders(<MerchantFinanceiroScreen />, { wallet });

    // Saldo do mock (59120 centavos) → "R$ 591,20" (espaço nbsp → regex nos dígitos).
    expect(await findByText(/591,20/)).toBeTruthy();
  });

  it('lista um lançamento do extrato do mock ("Furou Fila")', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByText } = renderWithProviders(<MerchantFinanceiroScreen />, { wallet });

    expect(await findByText('Furou Fila')).toBeTruthy();
  });

  it('"Solicitar Saque" navega para a tela de saque', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<MerchantFinanceiroScreen />, {
      wallet,
    });

    await findByTestId('btn-withdraw');
    fireEvent.press(getByTestId('btn-withdraw'));

    expect(mockPush).toHaveBeenCalledWith('/(merchant)/financeiro/withdraw');
  });

  it('renderiza o RevenueDonut ("Receita por serviço")', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByText } = renderWithProviders(<MerchantFinanceiroScreen />, { wallet });

    expect(await findByText('Receita por serviço')).toBeTruthy();
  });

  it('abre o drawer ao pressionar o menu (o item "Financeiro" fica visível)', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, getByTestId, queryByText, findByText } = renderWithProviders(
      <MerchantFinanceiroScreen />,
      { wallet },
    );

    await findByTestId('btn-withdraw');
    // Drawer fechado: o item "Financeiro" não está visível (não há esse texto na tela).
    expect(queryByText('Financeiro')).toBeNull();

    fireEvent.press(getByTestId('topbar-menu'));

    expect(await findByText('Financeiro')).toBeTruthy();
  });
});
