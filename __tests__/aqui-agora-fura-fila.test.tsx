import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import { formatBRL } from '../lib/formatters';
import { DEFAULT_QUEUE_SETTINGS } from '../lib/services/mock/queueFixtures';

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
    // pagamento no sheet dispara o onSuccess → joinQueue + modal de sucesso.
    fireEvent.press(await findByText('Confirmar e Pagar'));
    fireEvent.press(await findByText('Já realizei o pagamento'));

    // Modal de sucesso conforme Figma (node 2659:6381).
    await findByText('Pagamento Realizado');
    expect(getByText('Você será o próximo da fila!')).toBeTruthy();
    // Default = Furar fila → entra na fila como fura-fila.
    expect(joinSpy).toHaveBeenCalledWith('m1', { furaFila: true });
  });

  it('replaces to the senha screen when "Fechar" is pressed on the success modal', async () => {
    const { findByText } = renderWithProviders(<FuraFilaScreen />);

    fireEvent.press(await findByText('Confirmar e Pagar'));
    fireEvent.press(await findByText('Já realizei o pagamento'));
    fireEvent.press(await findByText('Fechar'));

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

    await findByText('Pagamento Realizado');
    expect(joinSpy).toHaveBeenCalledWith('m1', { furaFila: false });
  });

  it('renders the error state when the merchant id is unknown', async () => {
    mockParams = { merchantId: 'nope' }; // id inexistente → tela de erro
    const { findByText } = renderWithProviders(<FuraFilaScreen />);
    await findByText('Não foi possível carregar este estabelecimento.');
  });
});
