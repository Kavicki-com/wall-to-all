import type { QiIndicacao, QiProgramRules, QiStatementEntry, QiSummary } from '../types';
import {
  FEE_FREE_THRESHOLD_CENTS,
  MIN_WITHDRAW_CENTS,
  WITHDRAW_FEE_CENTS,
} from './withdrawQuote';

/** Código de indicação exibido nos dois lados do app (Figma). */
export const QI_CODE = 'QI-HOG23-3892';

/** Tamanho de página de listIndicacoes (decisão #3 do plano). */
export const QI_PAGE_SIZE = 5;

/** Meta inicial do estado vazio ("Indique 5 amigos para liberar nível Bronze"). */
export const QI_EMPTY_NEXT_LEVEL: NonNullable<QiSummary['nextLevel']> = {
  name: 'Bronze',
  target: 5,
};

/**
 * Topo da escada de níveis: a meta que os dois resumos exibem ("Indique 30
 * amigos para liberar nível Ouro") E o limiar que o "Como funciona" mostra
 * ("30+ indicados ativos"). Fonte única, para as duas telas não se
 * contradizerem a um toque de distância.
 */
export const QI_TOP_LEVEL: NonNullable<QiSummary['nextLevel']> = {
  name: 'Ouro',
  target: 30,
};

/** Regras do programa exibidas no "Como funciona". Taxas espelham withdrawQuote.ts. */
export const FIXTURE_QI_RULES: QiProgramRules = {
  perServicePct: 10,
  monthlyBonusCents: 500,
  topLevelMultiplier: 2,
  topLevelThreshold: QI_TOP_LEVEL.target,
  minWithdrawCents: MIN_WITHDRAW_CENTS,
  feeCents: WITHDRAW_FEE_CENTS,
  feeFreeThresholdCents: FEE_FREE_THRESHOLD_CENTS,
  creditWindowHours: 24,
};

/** Hero do QI do cliente (Figma 2628:6934): R$ 74,09 / R$ 45,00 / 12 / 8 / meta Ouro-30. */
export const FIXTURE_CLIENT_SUMMARY: QiSummary = {
  balanceCents: 7409,
  totalEarnedCents: 4500,
  indicadosCount: 12,
  bonusCount: 8,
  nextLevel: { ...QI_TOP_LEVEL },
};

/**
 * Hero do QI do lojista (Figma 2606:5475): saldo R$ 89,09 e card "Ganhos por
 * indicação" com Lucro total R$ 45,00 / 6 Indicados / 8 Bônus / meta Ouro-30.
 * (O lucro total NÃO precisa bater com a soma dos "Você ganhou" das indicadas
 * — o próprio Figma é inconsistente nisso, como no lado cliente.)
 */
export const FIXTURE_MERCHANT_SUMMARY: QiSummary = {
  balanceCents: 8909,
  totalEarnedCents: 4500,
  indicadosCount: 6,
  bonusCount: 8,
  nextLevel: { ...QI_TOP_LEVEL },
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Soma `plusDays` dias a uma data ISO base — determinístico (sem Date.now()). */
function isoPlusDays(baseIso: string, plusDays: number): string {
  return new Date(new Date(baseIso).getTime() + plusDays * DAY_MS).toISOString();
}

/** Base das datas derivadas: a "Indicada em" do Lucas Almeida (Figma 2628:7149). */
const INDICATED_BASE_ISO = '2026-02-12T12:00:00.000Z';

/**
 * Indicado sintético determinístico (sem Math.random): agendamentos derivados
 * do cashback (~R$ 2,65 por agendamento, como no extrato do Lucas) e datas
 * escalonadas a partir de uma base fixa, 7 dias por índice.
 */
function buildIndicacao(
  idPrefix: string,
  index: number,
  name: string,
  earnedCents: number,
): QiIndicacao {
  const appointmentsCount = Math.max(1, Math.round(earnedCents / 265));
  const indicatedAt = isoPlusDays(INDICATED_BASE_ISO, index * 7);
  const firstAppointmentAt = isoPlusDays(indicatedAt, 3);
  return {
    id: `${idPrefix}-${String(index + 1).padStart(2, '0')}`,
    name,
    // avatarUrl null em TODOS: as telas caem em iniciais (nunca asset do Figma).
    avatarUrl: null,
    earnedCents,
    status: 'active',
    indicatedAt,
    firstAppointmentAt,
    lastActivityAt: isoPlusDays(firstAppointmentAt, appointmentsCount * 5),
    appointmentsCount,
  };
}

/** Nome × "Você ganhou" (centavos) dos 12 indicados do cliente (Figma 2628:6934). */
const CLIENT_SEED: ReadonlyArray<readonly [string, number]> = [
  ['Lucas Almeida', 1050],
  ['Rafael Pereira', 730],
  ['Eduardo Martins', 550],
  ['Vitor Gomes', 260],
  ['Gabriel Santos', 975],
  ['Thiago Oliveira', 1120],
  ['Bruno Lima', 490],
  ['André Almeida', 190],
  ['Mateus Costa', 890],
  ['Felipe Rodrigues', 680],
  ['Diego Fernandes', 375],
  ['Ricardo Melo', 99],
];

/** Nome × "Você ganhou" (centavos) das 6 indicadas do lojista (Figma 2606:5475). */
const MERCHANT_SEED: ReadonlyArray<readonly [string, number]> = [
  ['Hortti Frutti - Oba', 1050],
  ['Stella ROSE', 730],
  ['Pet Shop do Serginho', 550],
  ['Elegance Barbearia', 260],
  ['Oficina do Marcão', 975],
  ['Dr em Casa', 1120],
];

/** 12 indicados do cliente, ids estáveis qi-c-01..qi-c-12 (telas navegam por eles). */
export const FIXTURE_CLIENT_INDICACOES: readonly QiIndicacao[] = CLIENT_SEED.map(
  ([name, earnedCents], index) => {
    const base = buildIndicacao('qi-c', index, name, earnedCents);
    if (index === 0) {
      // Lucas Almeida espelha o detalhe do Figma 2628:7149: Ativa, 6 agendamentos,
      // última atividade na data do topo do extrato.
      return { ...base, appointmentsCount: 6, lastActivityAt: '2026-07-08T14:30:00.000Z' };
    }
    if (name === 'Ricardo Melo') {
      // Único inativo e sem agendamentos — exercita os caminhos null/"Inativa" das telas.
      return {
        ...base,
        status: 'inactive',
        appointmentsCount: 0,
        firstAppointmentAt: null,
        lastActivityAt: null,
      };
    }
    return base;
  },
);

/** 6 indicadas do lojista, ids estáveis qi-m-01..qi-m-06. */
export const FIXTURE_MERCHANT_INDICACOES: readonly QiIndicacao[] = MERCHANT_SEED.map(
  ([name, earnedCents], index) => buildIndicacao('qi-m', index, name, earnedCents),
);

/**
 * Extrato do Lucas Almeida espelhando o Figma 2628:7149: 4 agendamentos de
 * R$ 2,65 de cashback cada, datas ISO fixas (mais recente primeiro).
 */
const LUCAS_STATEMENT: readonly QiStatementEntry[] = [
  {
    id: 'qi-c-01-st-1',
    title: 'Agendamento realizado',
    subtitle: 'Carlos Silva',
    date: '2026-07-08T14:30:00.000Z',
    amountCents: 265,
  },
  {
    id: 'qi-c-01-st-2',
    title: 'Agendamento realizado',
    subtitle: 'Anderson Ribeiro',
    date: '2026-07-07T17:45:00.000Z',
    amountCents: 265,
  },
  {
    id: 'qi-c-01-st-3',
    title: 'Agendamento realizado',
    subtitle: 'Carlos Silva',
    date: '2026-07-05T10:20:00.000Z',
    amountCents: 265,
  },
  {
    id: 'qi-c-01-st-4',
    title: 'Agendamento realizado',
    subtitle: 'Silvio Santos',
    date: '2026-07-02T09:00:00.000Z',
    amountCents: 265,
  },
];

/** Clientes fictícios dos agendamentos sintéticos (ciclo determinístico). */
const STATEMENT_SUBTITLES = ['Carlos Silva', 'Anderson Ribeiro', 'Silvio Santos'] as const;

/**
 * Extrato sintético determinístico de um indicado: até 4 entradas de
 * "Agendamento realizado" com o cashback médio por agendamento, datas
 * escalonadas a partir do primeiro agendamento.
 */
function buildStatement(indicacao: QiIndicacao): QiStatementEntry[] {
  const count = Math.min(indicacao.appointmentsCount, 4);
  if (count === 0 || indicacao.firstAppointmentAt === null) {
    return [];
  }
  const firstAppointmentAt = indicacao.firstAppointmentAt;
  const amountCents = Math.round(indicacao.earnedCents / indicacao.appointmentsCount);
  return Array.from({ length: count }, (_, i) => ({
    id: `${indicacao.id}-st-${i + 1}`,
    title: 'Agendamento realizado',
    subtitle: STATEMENT_SUBTITLES[i % STATEMENT_SUBTITLES.length],
    date: isoPlusDays(firstAppointmentAt, i * 5),
    amountCents,
  }));
}

/** Extrato por id de indicação (os dois lados) — Lucas fixo do Figma, demais sintéticos. */
export const FIXTURE_QI_STATEMENTS: ReadonlyMap<string, readonly QiStatementEntry[]> = new Map(
  [...FIXTURE_CLIENT_INDICACOES, ...FIXTURE_MERCHANT_INDICACOES].map((indicacao) => [
    indicacao.id,
    indicacao.id === 'qi-c-01' ? LUCAS_STATEMENT : buildStatement(indicacao),
  ]),
);
