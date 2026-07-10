/**
 * Helpers puros para as métricas dos dashboards (Home).
 *
 * Todas as funções deste módulo são puras: sem React, sem Supabase, sem I/O.
 * Recebem números/estruturas simples e devolvem valores derivados prontos para
 * a camada de apresentação. Isso mantém a lógica de negócio testável em isolamento.
 */

export interface MonthOverviewInput {
  /** Receita acumulada no mês corrente. */
  currentRevenue: number;
  /** Receita total do mês anterior — usada como meta. */
  previousRevenue: number;
  /** Dia do mês corrente (1..31). */
  dayOfMonth: number;
  /** Número de dias do mês corrente (28..31). */
  daysInMonth: number;
}

export interface MonthOverview {
  /** Meta do mês (= receita do mês anterior). */
  forecast: number;
  /** Receita já realizada no mês corrente. */
  realized: number;
  /** Quanto ainda falta para bater a meta (nunca negativo). */
  remaining: number;
  /** Percentual da meta já realizado, arredondado. */
  pct: number;
  /** true quando o ritmo de receita acompanha o ritmo do mês. */
  onTrack: boolean;
}

/**
 * Resumo do mês para o card de meta.
 *
 * Usa a receita do mês anterior como meta implícita e compara o percentual
 * realizado com o percentual do mês já decorrido para dizer se o negócio está
 * "no ritmo". Sem receita anterior não há meta possível, então retorna null
 * (estado neutro — a UI deve mostrar um placeholder em vez de uma meta falsa).
 */
export function computeMonthOverview({
  currentRevenue,
  previousRevenue,
  dayOfMonth,
  daysInMonth,
}: MonthOverviewInput): MonthOverview | null {
  if (previousRevenue <= 0) return null;

  const forecast = previousRevenue;
  const realized = currentRevenue;
  const remaining = Math.max(0, forecast - realized);
  const pct = Math.round((realized / forecast) * 100);
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100);
  // Compara os percentuais JÁ ARREDONDADOS: assim 71% de receita empata com
  // 71% do mês decorrido e conta como "no ritmo".
  const onTrack = pct >= monthPct;

  return { forecast, realized, remaining, pct, onTrack };
}

export interface ServiceRevenueRow {
  /** Nome do serviço. */
  serviceName: string;
  /** Valor de receita atribuído a esse serviço nesta linha. */
  amount: number;
}

export interface RevenueSegment {
  /** Rótulo do segmento (nome do serviço ou "Outros"). */
  label: string;
  /** Receita agregada do segmento. */
  amount: number;
  /** Participação do segmento no total, arredondada. */
  pct: number;
}

/**
 * Agrupa a receita por serviço para o gráfico de composição.
 *
 * Soma os valores de cada serviço, ordena do maior para o menor e mantém no
 * máximo os 3 primeiros; toda a cauda restante é agregada num único segmento
 * "Outros" (posicionado sempre por último). Com 3 serviços ou menos não há
 * "Outros". Cada segmento carrega sua participação percentual no total.
 */
export function groupRevenueByService(rows: ServiceRevenueRow[]): {
  total: number;
  segments: RevenueSegment[];
} {
  if (rows.length === 0) return { total: 0, segments: [] };

  // Agrega por nome de serviço, preservando a ordem de primeira aparição.
  const totals = new Map<string, number>();
  for (const { serviceName, amount } of rows) {
    totals.set(serviceName, (totals.get(serviceName) ?? 0) + amount);
  }

  const total = [...totals.values()].reduce((acc, v) => acc + v, 0);

  // Ordena distintos em ordem decrescente de receita.
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);

  const pctOf = (amount: number) => Math.round((amount / total) * 100);

  const segments: RevenueSegment[] = [];

  if (sorted.length > 3) {
    // Mantém o top 3 e agrega toda a cauda em "Outros".
    for (const [label, amount] of sorted.slice(0, 3)) {
      segments.push({ label, amount, pct: pctOf(amount) });
    }
    const tailAmount = sorted
      .slice(3)
      .reduce((acc, [, amount]) => acc + amount, 0);
    segments.push({ label: 'Outros', amount: tailAmount, pct: pctOf(tailAmount) });
  } else {
    for (const [label, amount] of sorted) {
      segments.push({ label, amount, pct: pctOf(amount) });
    }
  }

  return { total, segments };
}

/**
 * Variação de um valor em relação ao período anterior.
 *
 * Devolve a variação absoluta, o percentual arredondado e a direção (subiu/
 * caiu). Sem base de comparação (período anterior 0 ou indefinido) não há
 * variação percentual calculável, então retorna null.
 */
export function computeDelta(
  current: number,
  previous: number | undefined
): { abs: number; pct: number; up: boolean } | null {
  if (previous === undefined || previous === 0) return null;

  const abs = current - previous;
  const pct = Math.round((abs / previous) * 100);
  const up = abs >= 0;

  return { abs, pct, up };
}

/**
 * Classifica a faixa de preço média em 1..5 cifrões.
 *
 * Calcula a média dos preços informados e a encaixa numa faixa fixa. Sem
 * preços não há faixa, então retorna null.
 */
export function priceTier(prices: number[]): 1 | 2 | 3 | 4 | 5 | null {
  if (prices.length === 0) return null;

  const avg = prices.reduce((acc, p) => acc + p, 0) / prices.length;

  if (avg <= 50) return 1;
  if (avg <= 100) return 2;
  if (avg <= 150) return 3;
  if (avg <= 250) return 4;
  return 5;
}
