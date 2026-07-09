import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockPush`/`mockReplace`/`mockBack` (prefixo `mock` exigido pelo
// hoisting) capturam a navegação da lista de espera.
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

import WaitingListScreen from '../app/(client)/aqui-agora/waiting-list';

// As fixtures do MockQueueService pré-populam a fila do m1 com 5 tickets
// (posições 1..5). Um `joinQueue('m1')` regular entra no fim → posição 6,
// estimatedWaitMinutes = 6 × avgServiceMinutes(10) = 60. Cada tick promove o
// primeiro da fila e decrementa a minha posição em 1; 6 ticks me levam a
// 'called' (posição 0).

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

describe('WaitingListScreen (aqui e agora — lista de espera ao vivo)', () => {
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
    const { findByText, getByText } = renderWithProviders(<WaitingListScreen />, { queue });

    // Snapshot inicial vem de getMyTicket: ordinal "6º" e "60 min".
    await findByText(/6º/);
    expect(getByText('60')).toBeTruthy();
  });

  it('updates the displayed position live as the queue advances (fake timers)', async () => {
    jest.useFakeTimers();
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1000 });
    await queue.joinQueue('m1'); // posição 6
    const { getByText, queryByText } = renderWithProviders(<WaitingListScreen />, { queue });

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
    const { findByText } = renderWithProviders(<WaitingListScreen />, { queue });

    // Abre o modal de confirmação e confirma a saída.
    fireEvent.press(await findByText('Sair da fila'));
    fireEvent.press(await findByText('Sim, sair'));

    await waitFor(() => expect(leaveSpy).toHaveBeenCalledWith(ticket.id));
  });

  it('navigates to the senha screen when the ticket becomes called (fake timers)', async () => {
    jest.useFakeTimers();
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1000 });
    await queue.joinQueue('m1'); // posição 6
    renderWithProviders(<WaitingListScreen />, { queue });

    await flushAsync();

    // Exatamente 6 ticks levam meu ticket de waiting(6) → called(0). O estado
    // final do lote é 'called', então o efeito de navegação dispara.
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('senha'));
  });
});
