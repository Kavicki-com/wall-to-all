/**
 * Testes de comportamento da tela de DETALHES DA INDICAÇÃO do QI (F4, Task 11,
 * Figma nodes 2628:7149 cliente e 2606:5546 lojista, espelhos exatos).
 *
 * A tela consome `useQiService()` (via ServicesProvider), `useToast()` (via
 * ToastProvider) e navega com `expo-router`, lendo o `[id]` da rota por
 * `useLocalSearchParams`. Mockamos, no escopo do módulo: `expo-router`
 * (useRouter → mockBack, useLocalSearchParams → `mockParams`, ajustado por
 * teste) e `react-native-safe-area-context` (useSafeAreaInsets, usado pelo hero
 * navy e pelos estados não carregados, que aqui são o topo da tela).
 *
 * O objeto do `useRouter()` é um SINGLETON estável de propósito: a tela carrega
 * num `useEffect` que tem `router` nas dependências (o catch navega de volta),
 * e um objeto novo a cada render reexecutaria a carga em laço. No runtime o
 * expo-router também devolve uma referência estável.
 *
 * Obs.: valores em BRL casam por REGEX nos dígitos ("10,50"), nunca pela string
 * literal (formatadores irmãos usam espaço não-quebrável).
 */
import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MockQiService } from '../lib/services/mock/mockQiService';
import type { QiIndicacao, QiSide } from '../lib/services/types';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockBack = jest.fn();
// Parâmetros da rota, reatribuídos por teste antes do render.
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => {
  // Referência estável (ver o cabeçalho): a tela usa `router` nas deps do
  // efeito. O método DELEGA para o mock em vez de referenciá-lo direto: a
  // fábrica é executada no primeiro require de 'expo-router', quando o
  // `const mockBack` ainda está na zona morta temporal (hoisting do
  // jest.mock). Só o corpo da arrow, avaliado depois, o enxerga. A tela só
  // navega para trás, então o router mock não expõe `push`.
  const router = {
    back: (...args: unknown[]) => mockBack(...args),
  };
  return {
    useRouter: () => router,
    useLocalSearchParams: () => mockParams,
  };
});

// O hero navy é o topo da tela e respeita o inset superior; inset determinístico.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

// O catch da tela chama `handleError`, que loga via `logger.error`. Silenciamos
// para o teste do ramo de erro não sujar a saída (mesmo padrão das demais suítes).
jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import ClientQiIndicacaoScreen from '../app/(client)/qi/indicacao/[id]';
import MerchantQiIndicacaoScreen from '../app/(merchant)/qi/indicacao/[id]';

/** Serviço cuja indicação tem a última atividade AGORA (exercita o "Hoje"). */
class TodayActivityQiService extends MockQiService {
  async getIndicacao(side: QiSide, id: string): Promise<QiIndicacao> {
    const indicacao = await super.getIndicacao(side, id);
    // Data construída no teste; quem deriva "hoje" é a tela (date-fns isToday).
    return { ...indicacao, lastActivityAt: new Date().toISOString() };
  }
}

/**
 * Stub cujas leituras NUNCA resolvem: prende a tela no estado de carga para se
 * poder afirmar que ela ainda oferece a saída ("Voltar"). Promessas pendentes
 * não deixam handles abertos, então o Jest encerra normalmente.
 */
class HangingQiService extends MockQiService {
  getIndicacao(): Promise<QiIndicacao> {
    return new Promise<QiIndicacao>(() => {});
  }
}

/**
 * Registra CADA leitura da indicação (lado + id). A tela carrega num efeito que
 * tem `router` e `showError` nas dependências: hoje eles são estáveis por
 * empréstimo (o ToastProvider memoiza `showError`, o `useRouter` devolve um
 * singleton), mas se alguém desmemoizar o provider a tela entra em laço de
 * requisições sem quebrar nenhuma asserção de conteúdo. A lista prova o lado E
 * a contagem.
 */
class RecordingQiService extends MockQiService {
  readonly loads: Array<[QiSide, string]> = [];

  async getIndicacao(side: QiSide, id: string): Promise<QiIndicacao> {
    this.loads.push([side, id]);
    return super.getIndicacao(side, id);
  }
}

function renderClient(qi: MockQiService) {
  return renderWithProviders(
    <ToastProvider>
      <ClientQiIndicacaoScreen />
    </ToastProvider>,
    { qi },
  );
}

function renderMerchant(qi: MockQiService) {
  return renderWithProviders(
    <ToastProvider>
      <MerchantQiIndicacaoScreen />
    </ToastProvider>,
    { qi },
  );
}

describe('QiIndicacaoDetails (detalhes da indicação)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'qi-c-01' };
  });

  it('hero: avatar em iniciais, nome e os 3 stats do Lucas Almeida', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText, getByTestId } = renderClient(qi);

    expect(await findByText('Lucas Almeida')).toBeTruthy();
    // avatarUrl null na fixture → iniciais (nunca asset do Figma).
    expect(getByText('LA')).toBeTruthy();

    // "Você ganhou": 1050 centavos → R$ 10,50 (regex nos dígitos).
    expect(getByTestId('qi-detail-earned').props.children).toMatch(/10,50/);
    expect(getByText('Você ganhou')).toBeTruthy();

    expect(getByTestId('qi-detail-status').props.children).toBe('Ativa');
    expect(getByText('Status da conta')).toBeTruthy();

    expect(getByTestId('qi-detail-appointments').props.children).toBe(6);
    expect(getByText('Agendamentos')).toBeTruthy();
  });

  it('card "Informações": rótulos e datas da fixture em dd/MM/yyyy', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText, getByTestId } = renderClient(qi);

    expect(await findByText('Informações')).toBeTruthy();
    expect(getByText('Indicada em')).toBeTruthy();
    expect(getByText('Primeiro agendamento')).toBeTruthy();
    expect(getByText('Última atividade')).toBeTruthy();

    // Fixture: indicada em 2026-02-12 e 1º agendamento 3 dias depois, as duas
    // ao MEIO-DIA UTC, então a data de calendário é estável em qualquer fuso.
    expect(getByTestId('qi-info-indicated-at').props.children).toBe('12/02/2026');
    expect(getByTestId('qi-info-first-appointment').props.children).toBe('15/02/2026');
  });

  it('"Última atividade" no dia corrente vira "Hoje"', async () => {
    const qi = new TodayActivityQiService({ latencyMs: 0 });
    const { findByTestId } = renderClient(qi);

    const lastActivity = await findByTestId('qi-info-last-activity');
    expect(lastActivity.props.children).toBe('Hoje');
  });

  it('extrato: título e os 4 lançamentos do Lucas Almeida', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getAllByText, getByText } = renderClient(qi);

    expect(await findByText('Extrato')).toBeTruthy();
    expect(getAllByText('Agendamento realizado')).toHaveLength(4);
    expect(getByText('Silvio Santos')).toBeTruthy();
    // 4 lançamentos de 265 centavos → R$ 2,65 (regex nos dígitos).
    expect(getAllByText(/2,65/)).toHaveLength(4);
  });

  it('indicação inativa e sem agendamentos: "Inativa", datas sem registro e extrato vazio', async () => {
    mockParams = { id: 'qi-c-12' }; // Ricardo Melo: inativo, 0 agendamentos, datas null.
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getAllByText, getByTestId, queryByTestId } = renderClient(qi);

    expect(await findByText('Ricardo Melo')).toBeTruthy();
    expect(getByTestId('qi-detail-status').props.children).toBe('Inativa');
    expect(getByTestId('qi-detail-appointments').props.children).toBe(0);

    // Primeiro agendamento e última atividade são null na fixture.
    expect(getAllByText('Sem registro')).toHaveLength(2);

    // Sem lançamentos: a lista NÃO é renderizada (contrato do QiStatementList),
    // e a seção mostra a mensagem de vazio.
    expect(queryByTestId('qi-statement-list')).toBeNull();
    expect(getByTestId('qi-statement-empty')).toBeTruthy();
  });

  it('id inexistente: mostra toast de erro e volta pela pilha de navegação', async () => {
    mockParams = { id: 'qi-c-99' };
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText } = renderClient(qi);

    expect(await findByText('Não foi possível carregar esta indicação.')).toBeTruthy();
    // O corpo do estado sem dados tem texto PRÓPRIO (distinto do toast) e
    // preserva a saída, para o caso de a tela seguir montada.
    expect(getByText('Indicação não encontrada.')).toBeTruthy();
    expect(getByText('Voltar')).toBeTruthy();
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('carga única: o efeito não recarrega a cada render', async () => {
    const qi = new RecordingQiService({ latencyMs: 0 });
    const { findByText } = renderClient(qi);

    await findByText('Lucas Almeida');
    // Espaço para renders adicionais: com `router`/`showError` instáveis nas
    // deps do efeito, a lista cresceria em vez de ficar em uma leitura só.
    await act(async () => {
      await Promise.resolve();
    });

    expect(qi.loads).toEqual([['client', 'qi-c-01']]);
  });

  it('estado de carga: mantém a saída da tela ("Voltar")', async () => {
    const qi = new HangingQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderClient(qi);

    // A carga nunca resolve: o usuário não pode ficar preso no spinner.
    await findByTestId('btn-back');
    fireEvent.press(getByTestId('btn-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('"Voltar" volta pela pilha de navegação', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderClient(qi);

    await findByTestId('btn-back');
    fireEvent.press(getByTestId('btn-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('a rota do lojista injeta o lado "merchant" (carrega a indicada do lojista)', async () => {
    mockParams = { id: 'qi-m-01' };
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText } = renderMerchant(qi);

    // Ids do lojista só existem no lado "merchant": se o wrapper injetasse
    // "client", a carga falharia e a tela voltaria em vez de exibir o nome.
    expect(await findByText('Hortti Frutti - Oba')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
