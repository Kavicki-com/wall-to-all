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
 * Obs.: as asserções de saldo casam por REGEX nos dígitos ("74,09"), nunca pela
 * string literal inteira. O `formatBRL` desta tela monta "R$ 74,09" com espaço
 * ASCII comum, mas os formatadores irmãos (`formatReais`/`formatCurrency`) usam
 * `Intl.NumberFormat`, que separa o "R$" com espaço NÃO-quebrável (U+00A0).
 * Casar pelos dígitos é a regra da casa: mantém o teste válido caso a tela troque
 * de formatador.
 */
import React from 'react';
import { Share } from 'react-native';
import { fireEvent, within } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQiService } from '../lib/services/mock/mockQiService';
import type { QiIndicacao, QiSide, QiSummary } from '../lib/services/types';

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

// O catch da tela chama `handleError`, que loga via `logger.error`. Silenciamos
// para o teste do ramo de erro não sujar a saída (mesmo padrão das demais suítes).
jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
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

// Subtítulos do QiCodeCard (a tela escolhe um deles pelo `indicadosCount`).
const SUBTITLE_COMPLETE = 'Convide amigos e ganhe 50% sobre as mensalidades';
const SUBTITLE_EMPTY = 'Convide amigos e receba cashback no PIX';

/**
 * Stub de QiService que rejeita TODA leitura enquanto estiver "fora do ar" e
 * volta a responder como o mock normal depois de `recover()`. Cobre o ramo de
 * erro da carga E a recuperação pelo "Tentar novamente".
 *
 * Por que um interruptor e não um "falha só na 1ª chamada": o mock de
 * `useFocusEffect` deste arquivo roda o callback a CADA render, então a falha do
 * primeiro load já dispara um novo load no render seguinte. Um stub que falhasse
 * uma única vez se curaria sozinho antes de o usuário tocar em "Tentar
 * novamente", e a asserção do estado de erro viraria corrida.
 */
class RecoverableQiService extends MockQiService {
  private failing = true;

  /** O serviço "volta": as próximas leituras respondem normalmente. */
  recover(): void {
    this.failing = false;
  }

  async getQiSummary(side: QiSide): Promise<QiSummary> {
    this.assertUp();
    return super.getQiSummary(side);
  }

  async getQiCode(side: QiSide): Promise<string> {
    this.assertUp();
    return super.getQiCode(side);
  }

  async listIndicacoes(
    side: QiSide,
    page: number,
  ): Promise<{ items: QiIndicacao[]; page: number; totalPages: number }> {
    this.assertUp();
    return super.listIndicacoes(side, page);
  }

  private assertUp(): void {
    if (this.failing) {
      throw new Error('QI indisponível');
    }
  }
}

/**
 * Stub cujas leituras NUNCA resolvem: prende a tela no estado de carga para se
 * poder afirmar o que ele oferece ao usuário. Promessas pendentes não deixam
 * handles abertos (nada de timers), então o Jest encerra normalmente.
 */
class HangingQiService extends MockQiService {
  getQiSummary(): Promise<QiSummary> {
    return new Promise<QiSummary>(() => {});
  }

  getQiCode(): Promise<string> {
    return new Promise<string>(() => {});
  }

  listIndicacoes(): Promise<{ items: QiIndicacao[]; page: number; totalPages: number }> {
    return new Promise<{ items: QiIndicacao[]; page: number; totalPages: number }>(() => {});
  }
}

describe('ClientQiScreen (QI do cliente)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Devolve o `Share.share` original ao módulo (o teste de compartilhamento o
    // espiona). `clearAllMocks` limpa chamadas, não implementações.
    jest.restoreAllMocks();
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
    const { findByText, findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, {
      qi,
    });

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
    const { findByText, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    expect(
      await findByText(
        'Você ainda não fez nenhuma indicação, compartilhe seu código QI para ganhar mais.',
      ),
    ).toBeTruthy();
    // Indicadores "Indicados" e "Bônus" zerados. A busca é presa ao card de
    // ganhos: um getAllByText('0') na árvore inteira passaria com zeros vindos
    // de qualquer outro lugar da tela.
    const earningsCard = getByTestId('qi-earnings-card');
    expect(within(earningsCard).getAllByText('0')).toHaveLength(2);
  });

  it('estado vazio: o card de código usa o subtítulo do estado vazio', async () => {
    const qi = new MockQiService({ latencyMs: 0, empty: true });
    const { findByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    const codeCard = within(await findByTestId('qi-code-card'));
    expect(codeCard.getByText(SUBTITLE_EMPTY)).toBeTruthy();
    expect(codeCard.queryByText(SUBTITLE_COMPLETE)).toBeNull();
  });

  it('estado completo: o card de código usa o subtítulo das mensalidades', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    const codeCard = within(await findByTestId('qi-code-card'));
    expect(codeCard.getByText(SUBTITLE_COMPLETE)).toBeTruthy();
    expect(codeCard.queryByText(SUBTITLE_EMPTY)).toBeNull();
  });

  it('compartilhar o código chama Share.share com a mensagem de convite', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    await findByTestId('qi-code-share');
    fireEvent.press(getByTestId('qi-code-share'));

    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('QI-HOG23-3892') }),
    );
  });

  it('"Como funciona o QI" navega para a tela de explicação', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    await findByTestId('btn-how-it-works');
    fireEvent.press(getByTestId('btn-how-it-works'));

    expect(mockPush).toHaveBeenCalledWith('/(client)/qi/how-it-works');
  });

  it('"Voltar" volta pela pilha de navegação', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    await findByTestId('btn-back');
    fireEvent.press(getByTestId('btn-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('falha de carga: mostra o erro com "Tentar novamente" e o retry recupera a tela', async () => {
    const qi = new RecoverableQiService({ latencyMs: 0 });
    const { findByText, findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, {
      qi,
    });

    // Primeiro load falhou: estado de erro em vez de spinner infinito.
    expect(await findByText('Não foi possível carregar o seu QI.')).toBeTruthy();
    await findByTestId('btn-retry');

    // O serviço volta e o usuário toca em "Tentar novamente".
    qi.recover();
    fireEvent.press(getByTestId('btn-retry'));

    // Saldo do mock (7409 centavos) → "R$ 74,09" (regex nos dígitos).
    expect(await findByText(/74,09/)).toBeTruthy();
  });

  it('estado de erro: mantém a saída da tela (menu e "Voltar")', async () => {
    const qi = new RecoverableQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    // Falha persistente (nunca chamamos recover): mesmo assim há como sair.
    await findByTestId('btn-retry');
    expect(getByTestId('topbar-menu')).toBeTruthy();

    fireEvent.press(getByTestId('btn-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('estado de carga: mantém a saída da tela (menu e "Voltar")', async () => {
    const qi = new HangingQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiScreen />, { qi });

    // A carga nunca resolve: o usuário não pode ficar preso no spinner.
    await findByTestId('btn-back');
    expect(getByTestId('topbar-menu')).toBeTruthy();

    fireEvent.press(getByTestId('btn-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
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
