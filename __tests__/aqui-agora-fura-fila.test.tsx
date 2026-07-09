import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import { formatBRL } from '../lib/formatters';
import { DEFAULT_QUEUE_SETTINGS } from '../lib/services/mock/queueFixtures';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockPush`/`mockBack` (prefixo `mock` exigido pelo hoisting) capturam
// a navegação; `useLocalSearchParams` devolve o merchantId encaminhado pela Task 15.
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ merchantId: 'm1' }),
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

    fireEvent.press(await findByText('Confirmar e Pagar'));

    // Modal de sucesso conforme Figma (node 2659:6381).
    await findByText('Pagamento Realizado');
    expect(getByText('Você será o próximo da fila!')).toBeTruthy();
    // Default = Furar fila → entra na fila como fura-fila.
    expect(joinSpy).toHaveBeenCalledWith('m1', { furaFila: true });
  });

  it('navigates to the senha screen when "Fechar" is pressed on the success modal', async () => {
    const { findByText } = renderWithProviders(<FuraFilaScreen />);

    fireEvent.press(await findByText('Confirmar e Pagar'));
    fireEvent.press(await findByText('Fechar'));

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('senha'));
  });
});
