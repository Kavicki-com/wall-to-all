/**
 * Testes de comportamento da tela "Como funciona o QI" (F4, Task 11, Figma
 * nodes 2628:7226 cliente e 2606:5632 lojista, espelhos EXATOS de copy).
 *
 * A tela consome `useQiService()` (via ServicesProvider) e navega com
 * `expo-router`. Mockamos, no escopo do módulo: `expo-router` (useRouter →
 * mockBack) e `react-native-safe-area-context` (useSafeAreaInsets, já que esta
 * tela não tem top bar e o corpo é o topo).
 *
 * O objeto do `useRouter()` é um SINGLETON estável de propósito: nenhum efeito
 * o toma como dependência hoje, mas um objeto novo a cada render é uma armadilha
 * conhecida (ver a tela irmã de detalhes). No runtime o expo-router também
 * devolve uma referência estável.
 *
 * Obs.: valores em BRL casam por REGEX nos dígitos ("5,00"), nunca pela string
 * literal (formatadores irmãos usam espaço não-quebrável). Nenhum número do
 * programa é literal na tela: tudo vem de `getProgramRules()`.
 */
import React from 'react';
import { Share } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';
import { MockQiService } from '../lib/services/mock/mockQiService';
import { QI_INVITE_URL } from '../lib/qi/shareMessage';
import type { QiProgramRules, QiSide } from '../lib/services/types';

// ── Mocks de escopo de módulo (içados pelo Jest acima dos imports) ──────────

const mockBack = jest.fn();
jest.mock('expo-router', () => {
  // Referência estável (ver o cabeçalho). O método DELEGA para o mock em vez de
  // referenciá-lo direto: a fábrica roda no primeiro require de 'expo-router',
  // quando o `const mockBack` ainda está na zona morta temporal (hoisting do
  // jest.mock); só o corpo da arrow, avaliado depois, o enxerga. A tela só
  // navega para trás, então o router mock não expõe `push`.
  const router = {
    back: (...args: unknown[]) => mockBack(...args),
  };
  return { useRouter: () => router };
});

// Sem top bar, o corpo é o topo da tela e respeita o inset superior.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

// O catch da tela chama `handleError`, que loga via `logger.error`. Silenciamos
// para o teste do ramo de erro não sujar a saída (mesmo padrão das demais suítes).
jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

import ClientQiHowItWorksScreen from '../app/(client)/qi/how-it-works';
import MerchantQiHowItWorksScreen from '../app/(merchant)/qi/how-it-works';

/** Registra o lado com que a tela pediu o código (o único observável do `side`). */
class RecordingQiService extends MockQiService {
  readonly codeSides: QiSide[] = [];

  async getQiCode(side: QiSide): Promise<string> {
    this.codeSides.push(side);
    return super.getQiCode(side);
  }
}

/**
 * Stub cuja leitura das regras NUNCA resolve: prende a tela no estado de carga
 * para se poder afirmar que ela ainda oferece a saída ("Voltar"). Promessas
 * pendentes não deixam handles abertos, então o Jest encerra normalmente.
 */
class HangingQiService extends MockQiService {
  getProgramRules(): Promise<QiProgramRules> {
    return new Promise<QiProgramRules>(() => {});
  }
}

/**
 * Regras com um limiar de nível máximo DIFERENTE da fixture: prova que a dica
 * do nível Ouro sai de `topLevelThreshold`, e não de um literal na tela.
 */
class CustomThresholdQiService extends MockQiService {
  async getProgramRules(): Promise<QiProgramRules> {
    return { ...(await super.getProgramRules()), topLevelThreshold: 42 };
  }
}

/** Falha só na PRIMEIRA leitura das regras: exercita o "Tentar novamente". */
class FlakyQiService extends MockQiService {
  private calls = 0;

  async getProgramRules(): Promise<QiProgramRules> {
    this.calls += 1;
    if (this.calls === 1) {
      throw new Error('falha simulada de rede');
    }
    return super.getProgramRules();
  }
}

describe('QiHowItWorks (como funciona o QI)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Devolve o `Share.share` original ao módulo (o teste do CTA o espiona).
    // `clearAllMocks` limpa chamadas, não implementações.
    jest.restoreAllMocks();
  });

  it('cabeçalho: título e subtítulo do programa', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText } = renderWithProviders(<ClientQiHowItWorksScreen />, { qi });

    expect(await findByText('Programa QI')).toBeTruthy();
    expect(getByText('Cashback ilimitado por indicação')).toBeTruthy();
  });

  it('os 3 passos numerados, com título e descrição', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText } = renderWithProviders(<ClientQiHowItWorksScreen />, { qi });

    expect(await findByText('Compartilhe seu código')).toBeTruthy();
    expect(
      getByText('Convide amigos via Pix, WhatsApp ou link direto. Cada amigo vira sua indicação.'),
    ).toBeTruthy();

    expect(getByText('Amigos viram clientes')).toBeTruthy();
    expect(
      getByText('Quando seus indicados agendam serviços, você ganha automaticamente.'),
    ).toBeTruthy();

    expect(getByText('Receba via Pix')).toBeTruthy();
    expect(getByText('Saque seu cashback acumulado.')).toBeTruthy();

    // Os círculos numerados são a ordem visível dos passos.
    expect(getByText('1')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('"Quanto você ganha?": as 3 linhas vêm das regras do programa', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByText, getByTestId, unmount } = renderWithProviders(
      <ClientQiHowItWorksScreen />,
      { qi },
    );

    expect(await findByText('Quanto você ganha?')).toBeTruthy();

    // perServicePct 10 → "10%" (nunca literal na tela).
    expect(getByText('Por serviço')).toBeTruthy();
    expect(getByTestId('qi-earn-per-service').props.children).toMatch(/10%/);

    // monthlyBonusCents 500 → "+R$ 5,00" (regex nos dígitos).
    expect(getByText('Bônus mensal')).toBeTruthy();
    expect(getByTestId('qi-earn-monthly-bonus').props.children).toMatch(/\+.*5,00/);

    // topLevelMultiplier 2 → "x2 cashback"; topLevelThreshold 30 → a dica traz
    // o MESMO número da meta do card de ganhos do QI ("Indique 30 amigos para
    // liberar nível Ouro"), que sai da mesma escada de níveis.
    expect(getByText('Nível Ouro')).toBeTruthy();
    expect(getByTestId('qi-earn-top-level').props.children).toMatch(/x2 cashback/);
    expect(getByText('30+ indicados ativos')).toBeTruthy();
    unmount();

    // Prova de que o limiar NÃO é literal na tela: com regras de outro limiar,
    // a dica acompanha as regras.
    const custom = renderWithProviders(<ClientQiHowItWorksScreen />, {
      qi: new CustomThresholdQiService({ latencyMs: 0 }),
    });
    expect(await custom.findByText('42+ indicados ativos')).toBeTruthy();
  });

  it('"Regras de participação": prazo, mínimo e taxa formatados das regras', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByTestId } = renderWithProviders(<ClientQiHowItWorksScreen />, { qi });

    expect(await findByText('Regras de participação')).toBeTruthy();

    // creditWindowHours 24 → "em até 24h".
    expect(getByTestId('qi-rule-credit-window').props.children).toMatch(/24h/);
    // minWithdrawCents 3000 → "R$ 30,00" (regex nos dígitos).
    expect(getByTestId('qi-rule-min-withdraw').props.children).toMatch(/30,00/);
    // feeCents 500 + feeFreeThresholdCents 20000 → "R$ 5,00" e "R$ 200,00".
    expect(getByTestId('qi-rule-fee').props.children).toMatch(/5,00/);
    expect(getByTestId('qi-rule-fee').props.children).toMatch(/200,00/);
    // Regra sem número (copy estática do Figma).
    expect(getByTestId('qi-rule-unlimited').props.children).toBe('Indicações ilimitadas');
  });

  it('CTA "Compartilhar meu código" chama Share.share com a mensagem de convite', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiHowItWorksScreen />, { qi });

    await findByTestId('btn-share-code');
    fireEvent.press(getByTestId('btn-share-code'));

    await waitFor(() =>
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          // Mesmo texto da Task 8 (fonte única em lib/qi/shareMessage.ts).
          message: expect.stringContaining('QI-HOG23-3892'),
          url: QI_INVITE_URL,
        }),
      ),
    );
  });

  it('"Ver o regulamento completo" é estático: existe como texto, não como botão', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByTestId, queryByRole } = renderWithProviders(<ClientQiHowItWorksScreen />, { qi });

    // Decisão #9 do plano: sem tela alvo no Figma, um Pressable com onPress
    // vazio seria enganoso: o rótulo aparece, mas nada o anuncia como acionável.
    expect(await findByTestId('qi-regulation-note')).toBeTruthy();
    expect(queryByRole('button', { name: 'Ver o regulamento completo' })).toBeNull();
  });

  it('estado de carga: mantém a saída da tela ("Voltar")', async () => {
    const qi = new HangingQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId } = renderWithProviders(<ClientQiHowItWorksScreen />, { qi });

    // A carga nunca resolve: o usuário não pode ficar preso no spinner.
    await findByTestId('btn-back');
    fireEvent.press(getByTestId('btn-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('falha de carga: estado de erro com saída e "Tentar novamente" que recarrega', async () => {
    const qi = new FlakyQiService({ latencyMs: 0 });
    const { findByTestId, getByTestId, findByText } = renderWithProviders(
      <ClientQiHowItWorksScreen />,
      { qi },
    );

    // 1ª leitura falha: erro com a mensagem do corpo e a saída preservada.
    expect(await findByTestId('btn-retry')).toBeTruthy();
    expect(await findByText('Não foi possível carregar as regras do programa.')).toBeTruthy();
    expect(getByTestId('btn-back')).toBeTruthy();

    fireEvent.press(getByTestId('btn-retry'));

    // 2ª leitura resolve: a tela mostra o conteúdo.
    expect(await findByText('Programa QI')).toBeTruthy();
  });

  it('"Voltar" volta pela pilha de navegação', async () => {
    const qi = new MockQiService({ latencyMs: 0 });
    const { findByText, getByTestId } = renderWithProviders(<ClientQiHowItWorksScreen />, { qi });

    await findByText('Programa QI');
    fireEvent.press(getByTestId('btn-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('as rotas injetam o lado: cliente pede o código como "client", lojista como "merchant"', async () => {
    const clientQi = new RecordingQiService({ latencyMs: 0 });
    const client = renderWithProviders(<ClientQiHowItWorksScreen />, { qi: clientQi });
    await client.findByText('Programa QI');
    expect(clientQi.codeSides).toEqual(['client']);
    client.unmount();

    const merchantQi = new RecordingQiService({ latencyMs: 0 });
    const merchant = renderWithProviders(<MerchantQiHowItWorksScreen />, { qi: merchantQi });
    await merchant.findByText('Programa QI');
    expect(merchantQi.codeSides).toEqual(['merchant']);
  });
});
