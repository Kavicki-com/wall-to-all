import React from 'react';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockQueueService } from '../lib/services/mock/mockQueueService';

// expo-router mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). O prefixo `mock` é exigido pelo hoisting; a tela usa router.back().
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

// A tela usa useSafeAreaInsets no padding do topo; inset determinístico (igual
// às demais telas "Aqui e Agora").
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import MerchantAquiAgoraSettingsScreen from '../app/(merchant)/aqui-agora/settings';

// A tela consome useToast(), então o corpo é envolvido em ToastProvider (o root
// do app o provê; aqui replicamos). As fixtures do m1 (LIVE_MERCHANT_ID)
// default: visibilityRadiusKm 3, autoCloseMinutes 120.
const renderScreen = (queue: MockQueueService) =>
  renderWithProviders(
    <ToastProvider>
      <MerchantAquiAgoraSettingsScreen />
    </ToastProvider>,
    { queue },
  );

describe('MerchantAquiAgoraSettingsScreen (Aqui e Agora — configurações do lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Testes com fake timers DEVEM restaurar timers reais (afterEach é LIFO —
    // roda antes do dispose do harness).
    jest.useRealTimers();
  });

  it('loads settings and shows the current radius from getSettings (3 km)', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByTestId } = renderScreen(queue);

    const value = await findByTestId('radius-value');
    expect(value.props.children).toBe('3 km');
  });

  it('updates the displayed radius to "5 km" when the 5 km preset chip is pressed', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByTestId, getByTestId } = renderScreen(queue);

    const presets = await findByTestId('radius-presets');
    fireEvent.press(within(presets).getByText('5 km'));

    await waitFor(() => expect(getByTestId('radius-value').props.children).toBe('5 km'));
  });

  it('selects the "Não encerrar" auto-close chip when pressed (deselecting the current)', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const { findByTestId } = renderScreen(queue);

    const presets = await findByTestId('autoclose-presets');
    // Ordem dos presets: 30 min, 1h, 2h, 3h, Não encerrar. Default 120 → "2h".
    const buttons = within(presets).getAllByRole('button');
    expect(buttons[2].props.accessibilityState.selected).toBe(true); // "2h"

    fireEvent.press(buttons[4]); // "Não encerrar"

    await waitFor(() => {
      const updated = within(presets).getAllByRole('button');
      expect(updated[4].props.accessibilityState.selected).toBe(true); // "Não encerrar"
      expect(updated[2].props.accessibilityState.selected).toBe(false); // "2h" desmarcado
    });
  });

  it('saves the chosen values via updateSettings and shows the success toast', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    const spy = jest.spyOn(queue, 'updateSettings');
    const { findByTestId, getByTestId, findByText } = renderScreen(queue);

    const radiusPresets = await findByTestId('radius-presets');
    fireEvent.press(within(radiusPresets).getByText('5 km'));

    const autoclosePresets = getByTestId('autoclose-presets');
    fireEvent.press(within(autoclosePresets).getByText('Não encerrar'));

    fireEvent.press(getByTestId('btn-save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ visibilityRadiusKm: 5, autoCloseMinutes: null }),
      ),
    );
    await findByText('Configurações salvas');
  });

  it('reflects a loaded null autoCloseMinutes ("Não encerrar") and radius 5 on mount', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    // Config carregada NÃO-default: encerramento null (Não encerrar) + raio 5. Cobre
    // a direção getSettings → UI para o caso especial null (a razão da extensão do
    // domínio), não só o default do m1.
    await queue.updateSettings({ autoCloseMinutes: null, visibilityRadiusKm: 5 });
    const { findByTestId } = renderScreen(queue);

    const value = await findByTestId('radius-value');
    expect(value.props.children).toBe('5 km');

    const presets = await findByTestId('autoclose-presets');
    const buttons = within(presets).getAllByRole('button');
    // Ordem: 30 min, 1h, 2h, 3h, Não encerrar.
    expect(buttons[4].props.accessibilityState.selected).toBe(true); // "Não encerrar"
    expect(buttons[2].props.accessibilityState.selected).toBe(false); // "2h" (default) não
  });

  it('shows the error toast when updateSettings rejects', async () => {
    const queue = new MockQueueService({ latencyMs: 0, tickIntervalMs: 1_000_000 });
    jest.spyOn(queue, 'updateSettings').mockRejectedValueOnce(new Error('falhou'));
    const { findByTestId, getByTestId, findByText } = renderScreen(queue);

    // Espera o formulário carregar (getSettings resolve) antes de salvar.
    await findByTestId('btn-save');
    fireEvent.press(getByTestId('btn-save'));

    await findByText('Não foi possível salvar. Tente novamente.');
  });
});
