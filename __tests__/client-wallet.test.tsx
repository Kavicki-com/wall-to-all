/**
 * Testes de comportamento da carteira do cliente (F3 — Carteira/Financeiro,
 * Task 4, Figma node 2715:3681).
 *
 * A tela consome `useWalletService()` (via ServicesProvider) e navega com
 * `expo-router`. Mockamos `expo-router` no escopo do módulo (useRouter →
 * mockPush/mockBack; useFocusEffect roda o callback UMA vez para simular o load
 * no foco/mount) e `react-native-safe-area-context` (só useSafeAreaInsets, usado
 * pela HomeTopBar). O serviço vem de um `MockWalletService({ latencyMs: 0 })`
 * fresco injetado via `renderWithProviders(..., { wallet })`.
 *
 * Cobrem: render dos cartões + chave Pix (CPF) do mock após o load, estado
 * vazio do extrato, navegação dos botões "Adicionar cartão"/"Adicionar chave
 * Pix" e abertura do drawer pelo menu.
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

import ClientWalletScreen from '../app/(client)/wallet/index';

describe('ClientWalletScreen (carteira do cliente)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('após o load, exibe os cartões do mock e a chave Pix (CPF) mascarada', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, getByText } = renderWithProviders(<ClientWalletScreen />, { wallet });

    // A pilha de cartões renderiza um slot por cartão do mock (2 cartões).
    expect(await findByTestId('cards-stack-card-0')).toBeTruthy();
    expect(await findByTestId('cards-stack-card-1')).toBeTruthy();
    // A chave Pix (CPF) do mock aparece já mascarada.
    expect(getByText('*********-12')).toBeTruthy();
  });

  it('extrato vazio → exibe "Nenhum lançamento encontrado"', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByText } = renderWithProviders(<ClientWalletScreen />, { wallet });

    expect(await findByText('Nenhum lançamento encontrado')).toBeTruthy();
  });

  it('"+ Adicionar cartão" navega para a tela de novo cartão', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientWalletScreen />, { wallet });

    await findByTestId('btn-add-card');
    fireEvent.press(getByTestId('btn-add-card'));

    expect(mockPush).toHaveBeenCalledWith('/(client)/wallet/new-card');
  });

  it('o botão de adicionar do PixKeySection navega para a tela de nova chave Pix', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientWalletScreen />, { wallet });

    await findByTestId('btn-add-pix');
    fireEvent.press(getByTestId('btn-add-pix'));

    expect(mockPush).toHaveBeenCalledWith('/(client)/wallet/new-pix-key');
  });

  it('abre o drawer ao pressionar o menu (o item "Carteira" fica visível)', async () => {
    const wallet = new MockWalletService({ latencyMs: 0 });
    const { findByTestId, getByTestId, queryByText, findByText } = renderWithProviders(
      <ClientWalletScreen />,
      { wallet },
    );

    await findByTestId('btn-add-card');
    // Drawer fechado: o item "Carteira" não está visível (não há esse texto na tela).
    expect(queryByText('Carteira')).toBeNull();

    fireEvent.press(getByTestId('topbar-menu'));

    expect(await findByText('Carteira')).toBeTruthy();
  });
});
