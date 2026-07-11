import type {
  QiIndicacao,
  QiProgramRules,
  QiService,
  QiSide,
  QiStatementEntry,
  QiSummary,
  WithdrawQuote,
} from '../types';
import {
  FIXTURE_CLIENT_INDICACOES,
  FIXTURE_CLIENT_SUMMARY,
  FIXTURE_MERCHANT_INDICACOES,
  FIXTURE_MERCHANT_SUMMARY,
  FIXTURE_QI_RULES,
  FIXTURE_QI_STATEMENTS,
  QI_CODE,
  QI_EMPTY_NEXT_LEVEL,
  QI_PAGE_SIZE,
} from './qiFixtures';
import { computeWithdrawQuote, MIN_WITHDRAW_CENTS } from './withdrawQuote';

/**
 * Latência simulada (ms) para uso no app real. Mesmo design do
 * MockWalletService: o construtor aceita `latencyMs` com default **0** (testes
 * resolvem via microtask), e o ServicesProvider passa `SIMULATED_LATENCY_MS`
 * explicitamente para simular latência de rede realista dentro do app.
 */
export const SIMULATED_LATENCY_MS = 300;

export interface MockQiServiceOptions {
  /** Latência simulada (ms) das operações. Default 0 — ver SIMULATED_LATENCY_MS. */
  latencyMs?: number;
  /** Estado "QI em branco": resumos zerados (meta Bronze/5) e listas vazias. */
  empty?: boolean;
}

/** Estado em memória de UM lado (cliente ou lojista) do programa. */
interface QiSideState {
  summary: QiSummary;
  indicacoes: QiIndicacao[];
  statements: Map<string, QiStatementEntry[]>;
}

/** Cópia profunda o suficiente de um QiSummary (nextLevel é objeto aninhado). */
function cloneSummary(summary: QiSummary): QiSummary {
  return { ...summary, nextLevel: summary.nextLevel ? { ...summary.nextLevel } : null };
}

/** Resumo do estado vazio: tudo zerado, meta "Indique 5 amigos" (Bronze). */
function emptySummary(): QiSummary {
  return {
    balanceCents: 0,
    totalEarnedCents: 0,
    indicadosCount: 0,
    bonusCount: 0,
    nextLevel: { ...QI_EMPTY_NEXT_LEVEL },
  };
}

/** Monta o estado inicial de um lado a partir das fixtures (cópias, nunca referências). */
function buildSideState(side: QiSide, empty: boolean): QiSideState {
  if (empty) {
    return { summary: emptySummary(), indicacoes: [], statements: new Map() };
  }
  const summary = side === 'client' ? FIXTURE_CLIENT_SUMMARY : FIXTURE_MERCHANT_SUMMARY;
  const indicacoes = side === 'client' ? FIXTURE_CLIENT_INDICACOES : FIXTURE_MERCHANT_INDICACOES;
  const statements = new Map<string, QiStatementEntry[]>();
  for (const indicacao of indicacoes) {
    const entries = FIXTURE_QI_STATEMENTS.get(indicacao.id) ?? [];
    statements.set(
      indicacao.id,
      entries.map((entry) => ({ ...entry })),
    );
  }
  return {
    summary: cloneSummary(summary),
    indicacoes: indicacoes.map((indicacao) => ({ ...indicacao })),
    statements,
  };
}

/**
 * Implementação mock de QiService, 100% em memória. UMA instância serve os
 * dois lados do app (decisão #2 do plano): cliente e lojista são espelhos com
 * fixtures distintas, indexados por `side`. Getters devolvem cópias defensivas
 * — uma tela nunca muta o estado interno. Sem timers persistentes (só o
 * `delay()` por chamada), logo NÃO precisa de dispose. Valores monetários são
 * inteiros em centavos.
 */
export class MockQiService implements QiService {
  private readonly latencyMs: number;
  private readonly sides: Record<QiSide, QiSideState>;

  constructor(options: MockQiServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    const empty = options.empty ?? false;
    this.sides = {
      client: buildSideState('client', empty),
      merchant: buildSideState('merchant', empty),
    };
  }

  async getQiSummary(side: QiSide): Promise<QiSummary> {
    await this.delay();
    return cloneSummary(this.sides[side].summary);
  }

  async getQiCode(side: QiSide): Promise<string> {
    await this.delay();
    void side; // o código de indicação é o mesmo nos dois lados.
    return QI_CODE;
  }

  async listIndicacoes(
    side: QiSide,
    page: number,
  ): Promise<{ items: QiIndicacao[]; page: number; totalPages: number }> {
    await this.delay();
    const { indicacoes } = this.sides[side];
    // Mínimo 1: a página 1 é sempre válida (estado vazio devolve lista vazia).
    const totalPages = Math.max(1, Math.ceil(indicacoes.length / QI_PAGE_SIZE));
    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
      throw new Error(`Página fora do intervalo: ${page} (válido: 1–${totalPages}).`);
    }
    const start = (page - 1) * QI_PAGE_SIZE;
    const items = indicacoes
      .slice(start, start + QI_PAGE_SIZE)
      .map((indicacao) => ({ ...indicacao }));
    return { items, page, totalPages };
  }

  async getIndicacao(side: QiSide, id: string): Promise<QiIndicacao> {
    await this.delay();
    return { ...this.findIndicacao(side, id) };
  }

  async getIndicacaoStatement(side: QiSide, id: string): Promise<QiStatementEntry[]> {
    await this.delay();
    this.findIndicacao(side, id); // lança se a indicação não existir no lado.
    const entries = this.sides[side].statements.get(id) ?? [];
    return entries.map((entry) => ({ ...entry }));
  }

  async getProgramRules(): Promise<QiProgramRules> {
    await this.delay();
    return { ...FIXTURE_QI_RULES };
  }

  async quoteWithdraw(amountCents: number): Promise<WithdrawQuote> {
    await this.delay();
    return computeWithdrawQuote(amountCents);
  }

  async requestQiWithdraw(side: QiSide, amountCents: number, pixKeyId: string): Promise<void> {
    await this.delay();
    if (amountCents < MIN_WITHDRAW_CENTS) {
      throw new Error('O valor mínimo de saque é R$ 30,00.');
    }
    // As chaves Pix pertencem ao WalletService (decisão #5): aqui só se exige
    // uma seleção não-vazia — a tela garante que o id veio de getPixKeys().
    if (pixKeyId.trim() === '') {
      throw new Error('Selecione uma chave Pix para o saque.');
    }
    const state = this.sides[side];
    if (amountCents > state.summary.balanceCents) {
      throw new Error('Saldo insuficiente para o saque.');
    }
    state.summary.balanceCents -= amountCents;
  }

  /** Busca interna (referência viva, sem cópia); lança se não existir no lado. */
  private findIndicacao(side: QiSide, id: string): QiIndicacao {
    const indicacao = this.sides[side].indicacoes.find((item) => item.id === id);
    if (!indicacao) {
      throw new Error(`Indicação não encontrada: ${id}`);
    }
    return indicacao;
  }

  /**
   * Latência simulada: com latencyMs === 0 resolve via microtask para manter
   * os testes rápidos; com > 0 usa setTimeout de verdade.
   */
  private async delay(): Promise<void> {
    if (this.latencyMs === 0) {
      await Promise.resolve();
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
