import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockReplace`/`mockBack` (prefixo `mock` exigido pelo hoisting)
// capturam a navegação da senha.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

// A tela usa useSafeAreaInsets no hero; inset determinístico (igual às demais
// telas "Aqui e Agora").
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import SenhaScreen from '../app/(client)/aqui-agora/senha';

// As fixtures do MockQueueService pré-populam a fila do m1 com 5 tickets
// (posições 1..5). Um `joinQueue('m1')` regular entra no fim → posição 6,
// estimatedWaitMinutes = 6 × avgServiceMinutes(10) = 60. Cada tick promove o
// primeiro da fila e decrementa a minha posição em 1.

/**
 * Descarrega as microtasks pendentes (getMyTicket/subscribe + useMerchant)
 * dentro de `act`, sem depender de `findByText` (que poll com setTimeout e
 * trava sob fake timers). Três ciclos cobrem a cadeia async da tela.
 */
async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SenhaScreen (aqui e agora — senha / fura-fila ativado ao vivo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Testes com fake timers DEVEM restaurar timers reais (roda antes do
    // dispose do harness — afterEach é LIFO).
    jest.useRealTimers();
  });

  it('renders my current position and estimated wait from getMyTicket', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    await queue.joinQueue('m1'); // posição 6, estimatedWaitMinutes 60
    const { findByText, getByText } = renderWithProviders(<SenhaScreen />, { queue });

    // Snapshot inicial vem de getMyTicket: ordinal "6º" na senha e "60 min".
    await findByText(/6º/);
    expect(getByText('60')).toBeTruthy();
  });

  it('updates the displayed position live as the queue advances (fake timers)', async () => {
    jest.useFakeTimers();
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1000 });
    await queue.joinQueue('m1'); // posição 6
    const { getByText, queryByText } = renderWithProviders(<SenhaScreen />, { queue });

    // Resolve o getMyTicket assíncrono e a assinatura antes de avançar o relógio.
    await flushAsync();
    expect(getByText(/6º/)).toBeTruthy();

    // Um tick promove o primeiro da fila → minha posição 6 → 5; a assinatura
    // atualiza a UI ao vivo.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(queryByText(/6º/)).toBeNull();
    expect(getByText(/5º/)).toBeTruthy();
  });

  it('opens a confirmation modal and calls leaveQueue with the ticket id', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const leaveSpy = jest.spyOn(queue, 'leaveQueue');
    const ticket = await queue.joinQueue('m1');
    const { findByText } = renderWithProviders(<SenhaScreen />, { queue });

    // Abre o modal de confirmação e confirma a saída.
    fireEvent.press(await findByText('Sair da fila'));
    fireEvent.press(await findByText('Sim, sair'));

    await waitFor(() => expect(leaveSpy).toHaveBeenCalledWith(ticket.id));
  });

  it('shows the fura-fila front-of-line state (position 1)', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    await queue.joinQueue('m1', { furaFila: true }); // fura-fila entra na posição 1
    const { findByText, getByText } = renderWithProviders(<SenhaScreen />, { queue });

    // Estado desenhado no Figma: "1º" no hero + legenda "Você é o próximo".
    await findByText(/1º/);
    expect(getByText('Você é o próximo')).toBeTruthy();
  });

  it('shows "É a sua vez!" when the ticket is called (position 0) (fake timers)', async () => {
    jest.useFakeTimers();
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1000 });
    await queue.joinQueue('m1', { furaFila: true }); // posição 1
    const { getByText, queryByText } = renderWithProviders(<SenhaScreen />, { queue });

    await flushAsync();
    expect(getByText(/1º/)).toBeTruthy();

    // Um tick promove o fura-fila (1º) a chamado (posição 0): o hero deixa de
    // mostrar "1º" e passa a "É a sua vez!" (sem "0º / 0 min").
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(queryByText(/1º/)).toBeNull();
    expect(getByText('É a sua vez!')).toBeTruthy();
  });

  it('falls back to the empty state when the ticket resolves to a terminal status (fake timers)', async () => {
    jest.useFakeTimers();
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1000 });
    await queue.joinQueue('m1', { furaFila: true }); // posição 1
    const { getByText, queryByText } = renderWithProviders(<SenhaScreen />, { queue });

    await flushAsync();

    // tick 1 → chamado (posição 0); tick 2 → atendido (served) = terminal, o que
    // leva a senha ao estado vazio (não há laço de navegação).
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(queryByText('É a sua vez!')).toBeNull();
    expect(getByText('Você não está em nenhuma fila.')).toBeTruthy();
  });
});
