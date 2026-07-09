import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQueueService } from '../lib/services/mock/mockQueueService';

// expo-router é mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockPush`/`mockBack` (prefixo `mock` exigido pelo hoisting) capturam
// a navegação; `mockParams` controla o `[id]` lido via useLocalSearchParams e é
// mutável para exercitar merchants diferentes (fura-fila on/off).
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: { id: string } = { id: 'm1' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

// A TopBar consome useSafeAreaInsets; inset determinístico (igual top-bar.test.tsx).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import MerchantProfileScreen from '../app/(client)/aqui-agora/merchant/[id]';

describe('MerchantProfileScreen (aqui e agora — perfil do lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'm1' }; // Barbearia do Zé (fura-fila habilitado)
  });

  it('renders the merchant name, category and rating', async () => {
    const { findByText, getByText } = renderWithProviders(<MerchantProfileScreen />);
    await findByText('Barbearia do Zé'); // nome do merchant m1
    expect(getByText('Barbearia')).toBeTruthy(); // categoria
    expect(getByText(/4[.,]8/)).toBeTruthy(); // rating (merchant.rating === 4.8)
  });

  it('shows the queue state (tickets waiting and estimated wait)', async () => {
    const { findByText, getByText } = renderWithProviders(<MerchantProfileScreen />);
    // ticketsWaiting === 5 (fila "ao vivo" do m1)
    await findByText('(5) pessoas já estão nessa fila');
    // estimatedWaitMinutes === 5 * avgServiceMinutes(10) === 50
    expect(getByText(/50\s*min/)).toBeTruthy();
  });

  it('joins the queue and navigates to the waiting list on "Entrar na fila"', async () => {
    const queue = new MockQueueService({ latencyMs: 0 });
    const joinSpy = jest.spyOn(queue, 'joinQueue');
    const { findByText } = renderWithProviders(<MerchantProfileScreen />, { queue });
    fireEvent.press(await findByText('Entrar na fila'));
    await waitFor(() => expect(joinSpy).toHaveBeenCalledWith('m1'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('waiting-list'));
  });

  it('shows the fura-fila CTA and navigates to fura-fila when the merchant allows it', async () => {
    const { findByText } = renderWithProviders(<MerchantProfileScreen />);
    fireEvent.press(await findByText('Furar a fila'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('fura-fila'));
  });

  it('hides the fura-fila CTA when the merchant does not allow it', async () => {
    mockParams = { id: 'm3' }; // Café Aurora — furaFilaEnabled: false
    const { findByText, queryByText } = renderWithProviders(<MerchantProfileScreen />);
    await findByText('Café Aurora');
    expect(queryByText('Furar a fila')).toBeNull();
  });
});
