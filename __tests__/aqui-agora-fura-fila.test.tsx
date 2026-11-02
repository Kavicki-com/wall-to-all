import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import { formatBRL } from '../lib/formatters';
import { DEFAULT_QUEUE_SETTINGS } from '../lib/services/mock/queueFixtures';
import { MockWalletService } from '../lib/services/mock/mockWalletService';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockPush`/`mockReplace`/`mockBack` (prefixo `mock` exigido pelo
// hoisting) capturam a navegação; `mockParams` controla o merchantId lido via
// useLocalSearchParams (mutável p/ exercitar id inexistente → tela de erro).
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { merchantId: string } = { merchantId: 'm1' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

// A TopBar consome useSafeAreaInsets; inset determinístico (igual top-bar.test.tsx).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

// SVGs viram objeto no Jest: stub do logo do PaymentProcessingSheet (F8: o sheet
// Pix usa o "Processando" compartilhado da F5).
jest.mock('../lib/assets', () => ({
  ...jest.requireActual('../lib/assets'),
  IconLoading: () => null,
}));

import FuraFilaScreen from '../app/(client)/aqui-agora/fura-fila';

// Taxa fura-fila do m1 (fixtures) e base decorativa do serviço (espelha a tela).
const FEE_CENTS = DEFAULT_QUEUE_SETTINGS.furaFilaPriceCents; // 1500 → R$ 15,00
const SERVICE_BASE_CENTS = 8000; // R$ 80,00 (base decorativa; domínio não tem preço de serviço)

describe('FuraFilaScreen (aqui e agora — seleção fura-fila)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { merchantId: 'm1' }; // Barbearia do Zé (fura-fila habilitado)
  });

  it('renders the fura-fila fee from settings.furaFilaPriceCents', async () => {
    const { findByText } = renderWithProviders(<FuraFilaScreen />);
    // Badge "+R$ 15,00" na opção "Furar fila".
    await findByText(`+${formatBRL(FEE_CENTS)}`);
  });

  it('updates the Total when switching between Padrão and Furar fila', async () => {
    const { findByText, getByText, getByTestId } = renderWithProviders(<FuraFilaScreen />);
    // Aguarda o carregamento (CTA presente) e o default selecionado = Furar fila.
    await findByText('Confirmar e Pagar');
    expect(getByTestId('summary-total').props.children).toBe(
      formatBRL(SERVICE_BASE_CENTS + FEE_CENTS),
    ); // R$ 95,00

    // Padrão → total cai para a base (taxa 0).
    fireEvent.press(getByText('Padrão'));
    expect(getByTestId('summary-total').props.children).toBe(formatBRL(SERVICE_BASE_CENTS)); // R$ 80,00

    // Volta para Furar fila → total soma a taxa novamente.
    fireEvent.press(getByText('Furar fila'));
    expect(getByTestId('summary-total').props.children).toBe(
      formatBRL(SERVICE_BASE_CENTS + FEE_CENTS),
    ); // R$ 95,00
  });

  it('confirms payment, joins the queue with furaFila and shows the success modal', async () => {
    const queue = new MockQueueService({ latencyMs: 0 });
    const joinSpy = jest.spyOn(queue, 'joinQueue');
    const { findByText, getByText } = renderWithProviders(<FuraFilaScreen />, { queue });

    // "Confirmar e Pagar" abre o bottom-sheet Pix (método default). Confirmar o
    // pagamento no sheet mostra o "Processando..." por ~600ms e então dispara o
    // onSuccess → joinQueue + modal de sucesso.
    fireEvent.press(await findByText('Confirmar e Pagar'));
    fireEvent.press(await findByText('Já realizei o pagamento'));

    // Modal de sucesso conforme Figma (node 2659:6381). Timeout folgado cobre o
    // atraso do "Processando..." do sheet Pix.
    await findByText('Pagamento Realizado', {}, { timeout: 2000 });
    expect(getByText('Você será o próximo da fila!')).toBeTruthy();
    // Default = Furar fila → entra na fila como fura-fila.
    expect(joinSpy).toHaveBeenCalledWith('m1', { furaFila: true });
  });

  it('replaces to the senha screen when "Fechar" is pressed on the success modal', async () => {
    const { findByText } = renderWithProviders(<FuraFilaScreen />);

    fireEvent.press(await findByText('Confirmar e Pagar'));
    fireEvent.press(await findByText('Já realizei o pagamento'));
    // "Fechar" só aparece após o "Processando..." (~600ms) e o modal de sucesso.
    fireEvent.press(await findByText('Fechar', {}, { timeout: 2000 }));

    // `replace` (não `push`): voltar da senha não reexibe o modal já concluído.
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('senha'));
  });

  it('joins the queue as a regular ticket (furaFila:false) when "Padrão" is confirmed', async () => {
    const queue = new MockQueueService({ latencyMs: 0 });
    const joinSpy = jest.spyOn(queue, 'joinQueue');
    const { findByText, getByText, getByTestId } = renderWithProviders(<FuraFilaScreen />, {
      queue,
    });

    await findByText('Confirmar e Pagar');
    fireEvent.press(getByText('Padrão'));
    // Sem taxa de urgência → total é só a base.
    expect(getByTestId('summary-total').props.children).toBe(formatBRL(SERVICE_BASE_CENTS)); // R$ 80,00

    fireEvent.press(getByText('Confirmar e Pagar'));
    fireEvent.press(await findByText('Já realizei o pagamento'));

    // Timeout folgado cobre o atraso do "Processando..." do sheet Pix.
    await findByText('Pagamento Realizado', {}, { timeout: 2000 });
    expect(joinSpy).toHaveBeenCalledWith('m1', { furaFila: false });
  });

  it('renders the error state when the merchant id is unknown', async () => {
    mockParams = { merchantId: 'nope' }; // id inexistente → tela de erro
    const { findByText } = renderWithProviders(<FuraFilaScreen />);
    await findByText('Não foi possível carregar este estabelecimento.');
  });

  describe('cobrança sem re-cobrar (F8)', () => {
    async function payByCard(utils: ReturnType<typeof renderWithProviders>) {
      fireEvent.press(await utils.findByText('Alterar'));
      fireEvent.press(await utils.findByText('Confirmar e Pagar'));
      await utils.findByText('•••• 4242');
      fireEvent.press(utils.getByText('Concluir Pagamento'));
    }

    it('retries only joinQueue after an approved card when joining fails', async () => {
      const queue = new MockQueueService({ latencyMs: 0 });
      const joinSpy = jest
        .spyOn(queue, 'joinQueue')
        .mockRejectedValueOnce(new Error('fila indisponível'));
      const wallet = new MockWalletService({ latencyMs: 0 });
      const paySpy = jest.spyOn(wallet, 'payWithCard');
      const utils = renderWithProviders(<FuraFilaScreen />, { queue, wallet });

      await payByCard(utils);
      fireEvent.press(await utils.findByText('Tentar entrar na fila'));

      await utils.findByText('Pagamento Realizado', {}, { timeout: 2000 });
      expect(paySpy).toHaveBeenCalledTimes(1);
      expect(joinSpy).toHaveBeenCalledTimes(2);
      expect(paySpy.mock.calls[0][3]).toEqual({
        purpose: { kind: 'fura_fila', merchantRef: 'm1' },
        idempotencyKey: expect.stringMatching(/^chk_/),
      });
    });

    it('uses the same key for every charge of the same attempt', async () => {
      const wallet = new MockWalletService({ latencyMs: 0 });
      const paySpy = jest
        .spyOn(wallet, 'payWithCard')
        .mockResolvedValueOnce({ status: 'declined', paymentId: 'p1' });
      const utils = renderWithProviders(<FuraFilaScreen />, { wallet });

      fireEvent.press(await utils.findByText('Alterar'));
      fireEvent.press(await utils.findByText('Confirmar e Pagar'));
      await utils.findByText('•••• 4242');
      // A recusa resolve num microtask, fora do findBy.
      await act(async () => {
        fireEvent.press(utils.getByText('Concluir Pagamento'));
      });
      await utils.findByText('Pagamento recusado. Tente outro cartão.');
      fireEvent.press(utils.getByText('Concluir Pagamento'));
      await utils.findByText('Pagamento Realizado', {}, { timeout: 2000 });

      const keys = paySpy.mock.calls.map((call) => call[3]?.idempotencyKey);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toMatch(/^chk_/);
      expect(keys[1]).toBe(keys[0]);
    });
  });
});
