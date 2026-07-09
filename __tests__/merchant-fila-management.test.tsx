import React from 'react';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockPush`/`mockReplace`/`mockBack` (prefixo `mock` exigido pelo
// hoisting) capturam a navegação da gestão de fila do lojista.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

// A tela usa useSafeAreaInsets no header navy; inset determinístico (igual às
// demais telas "Aqui e Agora").
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import MerchantFilaScreen from '../app/(merchant)/aqui-agora/fila';

// As fixtures do MockQueueService pré-populam a fila do m1 (LIVE_MERCHANT_ID)
// com 5 tickets waiting (t2 = Bruno Lima é fura-fila) e status 'active'.

describe('MerchantFilaScreen (Aqui e Agora — gestão de fila do lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Testes com fake timers DEVEM restaurar timers reais (roda antes do
    // dispose do harness — afterEach é LIFO).
    jest.useRealTimers();
  });

  it('renders the live serving-card and a waiting ticket from getMerchantQueue', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    // Promove t1 (Ana Souza) para 'called' — passa a ser o "ATENDENDO AGORA".
    await queue.callNext();
    const { findByText } = renderWithProviders(<MerchantFilaScreen />, { queue });

    // serving-card mostra o ticket 'called'.
    await findByText('Ana Souza');
    // A lista "Próximos da fila" mostra um ticket 'waiting'.
    await findByText('Bruno Lima');
  });

  it('enables "Chamar próximo", calls callNext, and shows the promoted serving-card', async () => {
    // Fixtures: 5 waiting, ninguém 'called' → botão habilitado, sem serving-card.
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const callSpy = jest.spyOn(queue, 'callNext');
    const { getByTestId, findByText, queryByText } = renderWithProviders(
      <MerchantFilaScreen />,
      { queue },
    );

    // Espera o snapshot chegar (botão sai de disabled → enabled) e confirma que
    // ainda não há ninguém sendo atendido.
    await waitFor(() =>
      expect(getByTestId('btn-call-next').props.accessibilityState.disabled).toBe(false),
    );
    expect(queryByText('ATENDENDO AGORA')).toBeNull();

    fireEvent.press(getByTestId('btn-call-next'));

    // callNext dispara E a emissão ao vivo re-renderiza com o serving-card — prova o
    // caminho subscribe → setTickets → render, não só que o spy foi chamado.
    await waitFor(() => expect(callSpy).toHaveBeenCalled());
    await findByText('ATENDENDO AGORA');
  });

  it('disables "Chamar próximo" while a ticket is being served (resolve current first)', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    await queue.callNext(); // Ana Souza → 'called' (há alguém sendo atendido)
    const { getByTestId, findByText } = renderWithProviders(<MerchantFilaScreen />, { queue });

    // serving-card presente → "Chamar próximo" fica desabilitado (avançar encerraria
    // o atual como 'served'; força resolver Atendido/Não compareceu antes).
    await findByText('ATENDENDO AGORA');
    await waitFor(() =>
      expect(getByTestId('btn-call-next').props.accessibilityState.disabled).toBe(true),
    );
  });

  it('disables "Chamar próximo" and shows the empty message when there are no waiting tickets', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    // Esvazia a fila resolvendo todos os tickets das fixtures.
    const tickets = await queue.getMerchantQueue();
    for (const ticket of tickets) {
      await queue.resolveTicket(ticket.id, 'served');
    }
    const { findByText, getByTestId } = renderWithProviders(<MerchantFilaScreen />, { queue });

    await findByText(
      'Você ainda não tem nenhum cliente na fila, aguarde uma solicitação para visualizar',
    );
    expect(getByTestId('btn-call-next').props.accessibilityState.disabled).toBe(true);
  });

  it('filters to only fura-fila tickets when the "Furou fila" chip is pressed', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    // Garante ao menos um fura-fila além do fixture (t2 = Bruno Lima).
    await queue.joinQueue('m1', { furaFila: true });
    const { findByText, findByTestId, queryByText } = renderWithProviders(
      <MerchantFilaScreen />,
      { queue },
    );

    // Estado inicial (filtro "Aguardando"): um ticket regular aparece.
    await findByText('Ana Souza'); // regular (fixture)

    // Alterna para "Furou fila" (escopo no container de chips para evitar
    // ambiguidade com a etiqueta "Furou fila" dos cartões fura-fila).
    const chips = await findByTestId('filter-chips');
    fireEvent.press(within(chips).getByText('Furou fila'));

    // Só fura-fila: o regular some, o fura-fila (Bruno Lima, fixture) permanece.
    await waitFor(() => expect(queryByText('Ana Souza')).toBeNull());
    await findByText('Bruno Lima');
  });

  it('shows a "no fura-fila" message when the filter yields none but regulars remain', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    // Remove o único fura-fila das fixtures (Bruno Lima) — restam só regulares.
    const all = await queue.getMerchantQueue();
    const fura = all.find((ticket) => ticket.isFuraFila);
    await queue.resolveTicket(fura!.id, 'served');
    const { findByText, findByTestId, queryByText } = renderWithProviders(
      <MerchantFilaScreen />,
      { queue },
    );

    await findByText('Ana Souza'); // regular ainda na fila
    const chips = await findByTestId('filter-chips');
    fireEvent.press(within(chips).getByText('Furou fila'));

    // Filtro fura vazio, mas a fila NÃO está vazia → mensagem dedicada (não uma área
    // em branco), e NÃO a mensagem global de fila vazia.
    await findByText('Nenhum cliente furou a fila no momento');
    expect(queryByText(/Você ainda não tem nenhum cliente na fila/)).toBeNull();
  });

  it('resolves the serving ticket as served when "Atendido" is pressed', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const called = await queue.callNext(); // Ana Souza (t1) → 'called'
    const resolveSpy = jest.spyOn(queue, 'resolveTicket');
    const { findByTestId } = renderWithProviders(<MerchantFilaScreen />, { queue });

    fireEvent.press(await findByTestId('btn-resolve-served'));
    await waitFor(() => expect(resolveSpy).toHaveBeenCalledWith(called!.id, 'served'));
  });

  it('resolves the serving ticket as no_show when "Não compareceu" is pressed', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const called = await queue.callNext(); // Ana Souza (t1) → 'called'
    const resolveSpy = jest.spyOn(queue, 'resolveTicket');
    const { findByTestId } = renderWithProviders(<MerchantFilaScreen />, { queue });

    fireEvent.press(await findByTestId('btn-resolve-no-show'));
    await waitFor(() => expect(resolveSpy).toHaveBeenCalledWith(called!.id, 'no_show'));
  });
});
