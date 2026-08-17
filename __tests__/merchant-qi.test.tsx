/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
/**
 * Testes de comportamento da tela do QI do LOJISTA (F4, Task 9, Figma nodes
 * 2606:5475 completo e 2606:6250 vazio).
 *
 * A tela é uma rota FINA sobre o QiScreen compartilhado com o cliente: aqui só
 * se cobre o que varia por lado (fixture do lojista, rótulo "Suas indicadas",
 * rotas do grupo merchant e o drawer do lojista). Mockamos, no escopo do
 * módulo: `expo-router` (useRouter → mockPush/mockBack; useFocusEffect executa
 * como efeito → dispara o load no foco/mount) e
 * `react-native-safe-area-context` (só useSafeAreaInsets, usado pela
 * HomeTopBar). O serviço vem de um `MockQiService({ latencyMs: 0 })` fresco
 * injetado via `renderWithProviders(..., { qi })`.
 *
 * ESTADO VAZIO: NÃO re-testado aqui de propósito. Os componentes (QiScreen,
 * QiEarningsCard, QiCodeCard, QiIndicadosList) são os MESMOS do cliente e o
 * estado vazio, os subtítulos por estado, o share, o erro com "Tentar
 * novamente" e as saídas da tela já estão cobertos em client-qi.test.tsx
 * (Task 8).
 *
 * Obs.: as asserções de saldo casam por REGEX nos dígitos ("89,09"), nunca pela
 * string literal inteira. O `formatBRL` desta tela monta "R$ 89,09" com espaço
 * ASCII comum, mas os formatadores irmãos (`formatReais`/`formatCurrency`) usam
 * `Intl.NumberFormat`, que separa o "R$" com espaço NÃO-quebrável (U+00A0).
 * Casar pelos dígitos é a regra da casa: mantém o teste válido caso a tela troque
 * de formatador.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQiService } from '../lib/services/mock/mockQiService';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    // useFocusEffect fiel ao runtime: executa como EFEITO (dispara o load no
    // foco/mount e só re-executa quando o callback memoizado muda), honrando o
    // cleanup. Rodar `cb()` direto no corpo do render re-disparava a carga a
    // cada render (laço carga → render → carga) e enchia a saída de avisos de
    // act().
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

// HomeTopBar usa useSafeAreaInsets; inset determinístico (igual às demais telas).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

// O catch da tela chama `handleError`, que loga via `logger.error`. Silenciamos
// para nenhum ramo de erro sujar a saída (mesmo padrão das demais suítes).
jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import MerchantQiScreen from '../app/(merchant)/qi/index';

// As 5 primeiras indicadas da fixture do lojista (page size = 5), na ordem em
// que a lista as renderiza. A 6ª (Dr em Casa) já é da página 2.
const PAGE_1_NAMES = [
  'Hortti Frutti - Oba',
  'Stella ROSE',
  'Pet Shop do Serginho',
  'Elegance Barbearia',
  'Oficina do Marcão',
] as const;

describe('MerchantQiScreen (QI do lojista)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('após o load, exibe o Saldo Cashback formatado (R$ 89,09)', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText } = renderWithProviders(<MerchantQiScreen />, { qi });

    // Saldo do mock (8909 centavos) → "R$ 89,09" (nbsp → regex nos dígitos).
    expect(await findByText(/89,09/)).toBeTruthy();
  });

  it('a primeira página lista as 5 indicadas (inclui "Hortti Frutti - Oba")', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText, queryByText } = renderWithProviders(<MerchantQiScreen />, {
      qi,
    });

    expect(await findByText('Hortti Frutti - Oba')).toBeTruthy();
    // Os 5 nomes da página 1, na ordem da fixture do lojista.
    for (const name of PAGE_1_NAMES) {
      expect(getByText(name)).toBeTruthy();
    }
    // Page size = 5: a 1ª da página 2 (Dr em Casa) NÃO aparece ainda.
    expect(queryByText('Dr em Casa')).toBeNull();
  });

  it('mudar de página busca a página 2 (aparece um nome só da página 2)', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, findByTestId, getByTestId } = renderWithProviders(<MerchantQiScreen />, {
      qi,
    });

    // Espera a página 1 carregar antes de paginar.
    await findByText('Hortti Frutti - Oba');
    await findByTestId('qi-page-2');
    fireEvent.press(getByTestId('qi-page-2'));

    // Página 2 (item 6) traz "Dr em Casa", ausente na página 1.
    expect(await findByText('Dr em Casa')).toBeTruthy();
  });

  it('exibe o rótulo "Suas indicadas" na seção de indicadas', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText } = renderWithProviders(<MerchantQiScreen />, { qi });

    expect(await findByText('Suas indicadas')).toBeTruthy();
  });

  it('tocar numa indicada navega para o detalhe com o id da indicação', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<MerchantQiScreen />, { qi });

    await findByTestId('qi-indicado-qi-m-01');
    fireEvent.press(getByTestId('qi-indicado-qi-m-01'));

    expect(mockPush).toHaveBeenCalledWith('/(merchant)/qi/indicacao/qi-m-01');
  });

  it('"Solicitar Saque" navega para a tela de saque do QI do lojista', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<MerchantQiScreen />, { qi });

    await findByTestId('btn-withdraw');
    fireEvent.press(getByTestId('btn-withdraw'));

    expect(mockPush).toHaveBeenCalledWith('/(merchant)/qi/withdraw');
  });

  it('abre o drawer ao pressionar o menu (o item "QI" fica visível)', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId, queryByText, findByText } = renderWithProviders(
      <MerchantQiScreen />,
      { qi },
    );

    await findByTestId('btn-withdraw');
    // Drawer fechado: o item "QI" não está visível.
    expect(queryByText('QI')).toBeNull();

    fireEvent.press(getByTestId('topbar-menu'));

    expect(await findByText('QI')).toBeTruthy();
  });
});
