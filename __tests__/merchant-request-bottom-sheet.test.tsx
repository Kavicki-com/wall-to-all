import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import type { QueueTicket } from '../lib/services/types';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). O sheet em si não navega, mas o teste de integração renderiza a home
// lojista (MerchantAquiAgoraScreen), que consome useRouter(). Prefixo `mock`
// exigido pelo hoisting do Jest.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

// A home usa useSafeAreaInsets na top bar navy; inset determinístico (igual às
// demais telas "Aqui e Agora").
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import { RequestBottomSheet } from '../components/aqui-agora/RequestBottomSheet';
import MerchantAquiAgoraScreen from '../app/(merchant)/aqui-agora/index';

// Ticket construído à mão para os testes de componente — o sheet só usa
// customerName (nome + iniciais) e isFuraFila (etiqueta "Furou fila").
const baseTicket: QueueTicket = {
  id: 't-teste',
  number: 50,
  customerName: 'João Pedro',
  joinedAt: '2026-07-09T12:00:00.000Z',
  isFuraFila: false,
  status: 'waiting',
  positionInLine: 3,
  estimatedWaitMinutes: 30,
};

describe('RequestBottomSheet (solicitação recebida — lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the client name and the accept/reject buttons when visible with a ticket', () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { getByText, getByTestId } = renderWithProviders(
      <RequestBottomSheet visible ticket={baseTicket} onAccept={jest.fn()} onReject={jest.fn()} />,
      { queue },
    );

    expect(getByText('João Pedro')).toBeTruthy();
    expect(getByTestId('btn-accept')).toBeTruthy();
    expect(getByTestId('btn-reject')).toBeTruthy();
    expect(getByText('Aceitar serviço')).toBeTruthy();
    expect(getByText('Recusar')).toBeTruthy();
  });

  it('shows the "Furou fila" tag only for a fura-fila ticket', () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });

    const fura = renderWithProviders(
      <RequestBottomSheet
        visible
        ticket={{ ...baseTicket, isFuraFila: true }}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
      { queue },
    );
    expect(fura.queryByText('Furou fila')).toBeTruthy();

    const regular = renderWithProviders(
      <RequestBottomSheet
        visible
        ticket={{ ...baseTicket, isFuraFila: false }}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
      { queue },
    );
    expect(regular.queryByText('Furou fila')).toBeNull();
  });

  it('calls onAccept / onReject when the respective buttons are pressed', () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const { getByTestId } = renderWithProviders(
      <RequestBottomSheet visible ticket={baseTicket} onAccept={onAccept} onReject={onReject} />,
      { queue },
    );

    fireEvent.press(getByTestId('btn-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('btn-reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when not visible', () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { queryByText } = renderWithProviders(
      <RequestBottomSheet
        visible={false}
        ticket={baseTicket}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
      { queue },
    );

    expect(queryByText('SERVIÇO SOLICITADO')).toBeNull();
  });

  it('rejects when the backdrop is pressed (dispensar = recusar)', () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const onReject = jest.fn();
    const { getByTestId } = renderWithProviders(
      <RequestBottomSheet visible ticket={baseTicket} onAccept={jest.fn()} onReject={onReject} />,
      { queue },
    );

    // O backdrop fica atrás do sheet marcado accessibilityViewIsModal → é
    // ocultado da árvore de acessibilidade (correto: o leitor de tela usa os
    // botões, não o backdrop). Consulta explícita a elementos ocultos.
    fireEvent.press(getByTestId('request-sheet-backdrop', { includeHiddenElements: true }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});

describe('MerchantAquiAgoraScreen × RequestBottomSheet (integração)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not show the sheet on initial mount (fixture tickets must not trigger it)', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByText, queryByText } = renderWithProviders(<MerchantAquiAgoraScreen />, { queue });

    // Aguarda a carga da fila (as 5 fixtures já estão vistas → sem sheet).
    await findByText('Próximos da fila');
    expect(queryByText('SERVIÇO SOLICITADO')).toBeNull();
  });

  it('shows the sheet when a new ticket joins the merchant queue', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByText } = renderWithProviders(<MerchantAquiAgoraScreen />, { queue });

    await findByText('Próximos da fila');
    // Uma nova solicitação chega pela assinatura da fila do lojista.
    await act(async () => {
      await queue.joinQueue('m1', { furaFila: false });
    });

    await findByText('SERVIÇO SOLICITADO');
  });

  it('shows the "Furou fila" tag when a fura-fila ticket arrives (live path)', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByText } = renderWithProviders(<MerchantAquiAgoraScreen />, { queue });

    await findByText('Próximos da fila');
    // Chega uma solicitação fura-fila — a etiqueta propaga pela assinatura →
    // incomingRequest → RequestBottomSheet (cobre o wiring isFuraFila ponta a ponta).
    await act(async () => {
      await queue.joinQueue('m1', { furaFila: true });
    });

    await findByText('SERVIÇO SOLICITADO');
    await findByText('Furou fila');
  });

  it('rejecting the request resolves the ticket as no_show and hides the sheet', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const resolveSpy = jest.spyOn(queue, 'resolveTicket');
    const { findByText, queryByText, getByTestId } = renderWithProviders(
      <MerchantAquiAgoraScreen />,
      { queue },
    );

    await findByText('Próximos da fila');
    let joined: QueueTicket | undefined;
    await act(async () => {
      joined = await queue.joinQueue('m1', { furaFila: false });
    });
    await findByText('SERVIÇO SOLICITADO');

    fireEvent.press(getByTestId('btn-reject'));

    await waitFor(() => expect(resolveSpy).toHaveBeenCalledWith(joined?.id, 'no_show'));
    await waitFor(() => expect(queryByText('SERVIÇO SOLICITADO')).toBeNull());
  });

  it('accepting the request hides the sheet without removing the ticket from the queue', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByText, queryByText, getByTestId } = renderWithProviders(
      <MerchantAquiAgoraScreen />,
      { queue },
    );

    await findByText('Próximos da fila');
    let joined: QueueTicket | undefined;
    await act(async () => {
      joined = await queue.joinQueue('m1', { furaFila: false });
    });
    await findByText('SERVIÇO SOLICITADO');

    fireEvent.press(getByTestId('btn-accept'));
    await waitFor(() => expect(queryByText('SERVIÇO SOLICITADO')).toBeNull());

    // Aceitar não muta o domínio: o cliente continua na fila do lojista.
    const stillQueued = await queue.getMerchantQueue();
    expect(stillQueued.some((ticket) => ticket.id === joined?.id)).toBe(true);
  });
});
