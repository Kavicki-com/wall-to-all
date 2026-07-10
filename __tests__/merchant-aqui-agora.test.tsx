import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockPush`/`mockReplace`/`mockBack` (prefixo `mock` exigido pelo
// hoisting) capturam a navegação da home lojista do Aqui e Agora.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

// A tela usa useSafeAreaInsets na top bar navy; inset determinístico (igual às
// demais telas "Aqui e Agora").
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import MerchantAquiAgoraScreen from '../app/(merchant)/aqui-agora/index';

// As fixtures do MockQueueService pré-populam a fila do m1 (LIVE_MERCHANT_ID)
// com 5 tickets waiting e status 'active' por default.

describe('MerchantAquiAgoraScreen (Aqui e Agora — home do lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Testes com fake timers DEVEM restaurar timers reais (roda antes do
    // dispose do harness — afterEach é LIFO).
    jest.useRealTimers();
  });

  it('renders the OFFLINE view (no active-alert) when the queue is paused', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    await queue.setQueueStatus('paused');
    const { findByText, queryByText } = renderWithProviders(<MerchantAquiAgoraScreen />, { queue });

    // Status 'paused' → view offline: linha de status + sem o banner active-alert.
    await findByText('Você está offline');
    expect(queryByText('Aparecendo no mapa para clientes próximos')).toBeNull();
  });

  it('activates the Aqui e Agora and reveals the active-alert when the toggle is turned on', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    await queue.setQueueStatus('paused');
    const statusSpy = jest.spyOn(queue, 'setQueueStatus');
    const { findByText, getByTestId } = renderWithProviders(<MerchantAquiAgoraScreen />, { queue });

    // Parte da view offline e liga o toggle "Ativar o Aqui e Agora".
    await findByText('Você está offline');
    fireEvent.press(getByTestId('activation-toggle'));

    // setQueueStatus é chamado com 'active' e o banner active-alert aparece.
    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith('active'));
    await findByText('Aparecendo no mapa para clientes próximos');
  });

  it('shows the live queue summary (not the empty message) when the merchant queue has tickets', async () => {
    // Fixtures do m1: 5 tickets waiting + status 'active'.
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByText, findByTestId, queryByText } = renderWithProviders(
      <MerchantAquiAgoraScreen />,
      { queue },
    );

    await findByText('Próximos da fila');
    // Fila populada → resumo, não a mensagem vazia.
    expect(queryByText(/Você ainda não tem nenhum cliente na fila/)).toBeNull();
    // O "aguardando" reflete o getMerchantQueue (5 waiting nas fixtures).
    const waitingCount = await findByTestId('queue-waiting-count');
    expect(waitingCount.props.children).toBe(5);
  });

  it('shows the empty-queue message when the merchant queue has no tickets', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    // Esvazia a fila resolvendo todos os tickets das fixtures.
    const tickets = await queue.getMerchantQueue();
    for (const ticket of tickets) {
      await queue.resolveTicket(ticket.id, 'served');
    }
    const { findByText } = renderWithProviders(<MerchantAquiAgoraScreen />, { queue });

    await findByText(
      'Você ainda não tem nenhum cliente na fila, aguarde uma solicitação para visualizar',
    );
  });

  it('navigates to the queue management (fila) screen when a nearby-client row is pressed', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByTestId } = renderWithProviders(<MerchantAquiAgoraScreen />, { queue });

    const row = await findByTestId('nearby-client-row-0');
    fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('aqui-agora/fila'));
  });
});
