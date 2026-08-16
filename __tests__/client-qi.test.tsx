/**
 * Testes de comportamento da tela do QI do CLIENTE (F4 — Task 8, Figma nodes
 * 2628:6934 completo e 2628:7044 vazio).
 *
 * A tela consome `useQiService()` (via ServicesProvider) e navega com
 * `expo-router`. Mockamos, no escopo do módulo: `expo-router` (useRouter →
 * mockPush/mockBack; useFocusEffect roda o callback UMA vez → dispara o load no
 * foco/mount) e `react-native-safe-area-context` (só useSafeAreaInsets, usado
 * pela HomeTopBar). O serviço vem de um `MockQiService({ latencyMs: 0 })` fresco
 * injetado via `renderWithProviders(..., { qi })`.
 *
 * Obs.: strings BRL usam espaço NÃO-quebrável — as asserções de saldo casam por
 * REGEX nos dígitos ("74,09"), nunca pela string literal.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQiService } from '../lib/services/mock/mockQiService';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  // useFocusEffect roda o callback uma vez → dispara o load no mount/foco.
  useFocusEffect: (cb: () => void) => cb(),
}));

// HomeTopBar usa useSafeAreaInsets; inset determinístico (igual às demais telas).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

import ClientQiScreen from '../app/(client)/qi/index';

// Os 5 primeiros indicados da fixture do cliente (page size = 5), na ordem em
// que a lista os renderiza. O 6º (Thiago Oliveira) já é da página 2.
const PAGE_1_NAMES = [
  'Lucas Almeida',
  'Rafael Pereira',
  'Eduardo Martins',
  'Vitor Gomes',
  'Gabriel Santos',
] as const;

describe('ClientQiScreen (QI do cliente)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('após o load, exibe o Saldo Cashback formatado (R$ 74,09)', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText } = renderWithProviders(<ClientQiScreen />, { qi });

    // Saldo do mock (7409 centavos) → "R$ 74,09" (nbsp → regex nos dígitos).
    expect(await findByText(/74,09/)).toBeTruthy();
  });

  it('a primeira página lista os 5 indicados (inclui "Rafael Pereira")', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText, queryByText } = renderWithProviders(<ClientQiScreen />, {
      qi,
    });

    expect(await findByText('Rafael Pereira')).toBeTruthy();
    // Os 5 nomes da página 1, na ordem da fixture do cliente.
    for (const name of PAGE_1_NAMES) {
      expect(getByText(name)).toBeTruthy();
    }
    // Page size = 5: o 1º da página 2 (Thiago Oliveira) NÃO aparece ainda.
    expect(queryByText('Thiago Oliveira')).toBeNull();
  });

  it('mudar de página busca a página 2 (aparece um nome só da página 2)', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, findByTestId, getByTestId } = renderWithProviders(
      <ClientQiScreen />,
      { qi },
    );

    // Espera a página 1 carregar antes de paginar.
    await findByText('Rafael Pereira');
    await findByTestId('qi-page-2');
    fireEvent.press(getByTestId('qi-page-2'));

    // Página 2 (itens 6-10) traz "Mateus Costa", ausente na página 1.
    expect(await findByText('Mateus Costa')).toBeTruthy();
  });

  it('tocar num indicado navega para o detalhe com o id da indicação', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    await findByTestId('qi-indicado-qi-c-01');
    fireEvent.press(getByTestId('qi-indicado-qi-c-01'));

    expect(mockPush).toHaveBeenCalledWith('/(client)/qi/indicacao/qi-c-01');
  });

  it('"Solicitar Saque" navega para a tela de saque do QI', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    await findByTestId('btn-withdraw');
    fireEvent.press(getByTestId('btn-withdraw'));

    expect(mockPush).toHaveBeenCalledWith('/(client)/qi/withdraw');
  });

  it('estado vazio: exibe a mensagem sem indicados e zera os indicadores', async () => {
    const qi = new MockQiService({ latencyMs: 0, empty: true });
    const { findByText, getAllByText } = renderWithProviders(<ClientQiScreen />, { qi });

    expect(
      await findByText(
        'Você ainda não fez nenhuma indicação, compartilhe seu código QI para ganhar mais.',
      ),
    ).toBeTruthy();
    // Indicadores "Indicados" e "Bônus" zerados (dois nós de texto "0").
    expect(getAllByText('0').length).toBeGreaterThanOrEqual(2);
  });

  it('abre o drawer ao pressionar o menu (o item "QI" fica visível)', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId, queryByText, findByText } = renderWithProviders(
      <ClientQiScreen />,
      { qi },
    );

    await findByTestId('btn-withdraw');
    // Drawer fechado: o item "QI" não está visível.
    expect(queryByText('QI')).toBeNull();

    fireEvent.press(getByTestId('topbar-menu'));

    expect(await findByText('QI')).toBeTruthy();
  });
});
