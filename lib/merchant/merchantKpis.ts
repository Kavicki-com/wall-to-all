import { supabase } from '../supabase';
import { computeDelta } from '../dashboardMetrics';
import type { QiService } from '../services/types';

/**
 * KPIs do lojista ("Agendamentos", "Avaliação", "Indicações", "Novos clientes"),
 * extraídos da home do lojista (F2) na F7 para o perfil (profile-view
 * `2611:6893`) mostrar os mesmos números. Comportamento idêntico ao da home:
 *
 * - Janela: mês anterior → mês corrente (horário local).
 * - Só agendamentos 'confirmed'/'completed' contam (mesma definição de receita
 *   de `useMerchantMetrics`).
 * - "Agendamentos": contagem do mês com variação percentual.
 * - "Avaliação": média das reviews, sem variação (exigiria reviews datadas).
 * - "Indicações": `indicadosCount` do QiService, sem variação (o mock não tem série).
 * - "Novos clientes": clientes do mês sem agendamento anterior ao mês, com
 *   variação absoluta.
 *
 * A home usa `computeMerchantKpis` com as linhas que já busca (sem consulta
 * duplicada); o perfil usa `loadMerchantKpis`, que faz as consultas.
 */

// Status que contam como receita/agendamento (mesma definição de useMerchantMetrics).
export const REVENUE_STATUSES = ['confirmed', 'completed'];

/** Placeholder da nota quando não há avaliações (o mesmo glifo que a home sempre mostrou). */
export const NO_RATING = '\u2014';

// Variação exibida no badge do KpiCard (ou null para escondê-lo).
export type Delta = { text: string; up: boolean } | null;

export type KpiValue = { value: string; delta: Delta };

export interface MerchantKpis {
  agendamentos: KpiValue;
  avaliacao: KpiValue;
  indicacoes: KpiValue;
  novosClientes: KpiValue;
}

/** Valores iniciais (antes da carga ou em falha). */
export const EMPTY_MERCHANT_KPIS: MerchantKpis = {
  agendamentos: { value: '0', delta: null },
  avaliacao: { value: NO_RATING, delta: null },
  indicacoes: { value: '0', delta: null },
  novosClientes: { value: '0', delta: null },
};

// ── Shapes das linhas das consultas (o join do Supabase pode vir objeto ou array) ──
export interface JoinedService {
  id: number;
  name: string;
  price: number | null;
}
export type MaybeJoined<T> = T | T[] | null;

export interface MetricsRow {
  start_time: string;
  status: string;
  client_id: string | null;
  service: MaybeJoined<JoinedService>;
}
export interface ReviewRow {
  rating: number | null;
}

// Normaliza um join to-one que o Supabase às vezes entrega como array de 1.
export function firstOf<T>(value: MaybeJoined<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Variação percentual (ex.: "+12%"), usada em "Agendamentos".
export function pctDelta(delta: { pct: number; up: boolean } | null): Delta {
  if (delta === null) return null;
  return { text: `${delta.pct > 0 ? '+' : ''}${delta.pct}%`, up: delta.up };
}

// Variação absoluta (ex.: "+3"), usada em "Novos clientes".
export function absDelta(delta: { abs: number; up: boolean } | null): Delta {
  if (delta === null) return null;
  return { text: `${delta.abs > 0 ? '+' : ''}${delta.abs}`, up: delta.up };
}

/** Janelas do mês corrente e do anterior, no horário local. */
export function monthWindows(now: Date): {
  startOfCurrentMonth: Date;
  startOfPreviousMonth: Date;
  endOfCurrentMonth: Date;
} {
  return {
    startOfCurrentMonth: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    startOfPreviousMonth: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
    endOfCurrentMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

type MonthBucket = 'current' | 'previous' | null;

function bucketOf(row: MetricsRow, now: Date): MonthBucket {
  if (!REVENUE_STATUSES.includes(row.status)) return null;
  const { startOfCurrentMonth, startOfPreviousMonth, endOfCurrentMonth } = monthWindows(now);
  const start = new Date(row.start_time);
  if (start >= startOfCurrentMonth && start <= endOfCurrentMonth) return 'current';
  if (start >= startOfPreviousMonth && start < startOfCurrentMonth) return 'previous';
  return null;
}

/** Clientes distintos com agendamento que conta, por mês (base de "Novos clientes"). */
export function monthClientIds(
  rows: MetricsRow[],
  now: Date,
): { current: string[]; previous: string[] } {
  const current = new Set<string>();
  const previous = new Set<string>();
  for (const row of rows) {
    const bucket = bucketOf(row, now);
    if (!bucket || !row.client_id) continue;
    (bucket === 'current' ? current : previous).add(row.client_id);
  }
  return { current: [...current], previous: [...previous] };
}

/**
 * Quais destes clientes já tinham agendamento ANTES de `before`? Em vez de varrer
 * todo o histórico (que truncaria em lojas grandes), pergunta só pelos clientes
 * do mês. Quem não aparece é "novo".
 */
export async function fetchPriorClientIds(
  businessId: number,
  clientIds: string[],
  before: Date,
): Promise<Set<string>> {
  const prior = new Set<string>();
  if (clientIds.length === 0) return prior;
  const { data } = await supabase
    .from('appointments')
    .select('client_id')
    .eq('business_id', businessId)
    .in('client_id', clientIds)
    .lt('start_time', before.toISOString());
  for (const r of (data ?? []) as Array<{ client_id: string | null }>) {
    if (r.client_id) prior.add(r.client_id);
  }
  return prior;
}

/** Cálculo puro dos 4 KPIs a partir das linhas já buscadas. */
export function computeMerchantKpis(input: {
  rows: MetricsRow[];
  reviewRows: ReviewRow[];
  indicadosCount: number;
  now: Date;
  priorCurrent: Set<string>;
  priorPrevious: Set<string>;
}): MerchantKpis {
  const { rows, reviewRows, indicadosCount, now, priorCurrent, priorPrevious } = input;

  let currentCount = 0;
  let previousCount = 0;
  for (const row of rows) {
    const bucket = bucketOf(row, now);
    if (bucket === 'current') currentCount += 1;
    else if (bucket === 'previous') previousCount += 1;
  }

  const ratings = reviewRows
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === 'number');
  const ratingValue =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : NO_RATING;

  const clients = monthClientIds(rows, now);
  const newClientsCurrent = clients.current.filter((id) => !priorCurrent.has(id)).length;
  const newClientsPrevious = clients.previous.filter((id) => !priorPrevious.has(id)).length;

  return {
    agendamentos: {
      value: String(currentCount),
      delta: pctDelta(computeDelta(currentCount, previousCount)),
    },
    avaliacao: { value: ratingValue, delta: null },
    indicacoes: {
      // Vem do resumo do QI (mock): total de indicadas do lojista.
      value: String(indicadosCount),
      // TODO(F8): o mock do QI não modela série mensal; sem variação por ora.
      delta: null,
    },
    novosClientes: {
      value: String(newClientsCurrent),
      delta: absDelta(computeDelta(newClientsCurrent, newClientsPrevious)),
    },
  };
}

/**
 * Para telas que não buscam as linhas por conta própria (perfil): faz as
 * consultas da home (agendamentos da janela, reviews, resumo do QI) e calcula.
 * Erro de consulta lança, para a tela cair nos valores default.
 */
export async function loadMerchantKpis(
  businessId: number,
  qi: QiService,
  now: Date = new Date(),
): Promise<MerchantKpis> {
  const { startOfPreviousMonth, startOfCurrentMonth, endOfCurrentMonth } = monthWindows(now);

  const [metricsRes, reviewsRes, qiSummary] = await Promise.all([
    // Mesma consulta da home: DESC + teto alto para o truncamento derrubar os
    // meses mais antigos e nunca o corrente.
    supabase
      .from('appointments')
      .select('id, start_time, status, client_id, service:services(id, name, price)')
      .eq('business_id', businessId)
      .gte('start_time', startOfPreviousMonth.toISOString())
      .lte('start_time', endOfCurrentMonth.toISOString())
      .order('start_time', { ascending: false })
      .limit(2000),
    supabase.from('reviews').select('rating').eq('business_id', businessId),
    qi.getQiSummary('merchant'),
  ]);

  if (metricsRes.error) throw metricsRes.error;
  if (reviewsRes.error) throw reviewsRes.error;

  const rows = (metricsRes.data ?? []) as MetricsRow[];
  const clients = monthClientIds(rows, now);
  const [priorCurrent, priorPrevious] = await Promise.all([
    fetchPriorClientIds(businessId, clients.current, startOfCurrentMonth),
    fetchPriorClientIds(businessId, clients.previous, startOfPreviousMonth),
  ]);

  return computeMerchantKpis({
    rows,
    reviewRows: (reviewsRes.data ?? []) as ReviewRow[],
    indicadosCount: qiSummary.indicadosCount,
    now,
    priorCurrent,
    priorPrevious,
  });
}
