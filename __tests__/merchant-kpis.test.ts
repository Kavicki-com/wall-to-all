import {
  computeMerchantKpis,
  loadMerchantKpis,
  monthClientIds,
  monthWindows,
  EMPTY_MERCHANT_KPIS,
  NO_RATING,
} from '../lib/merchant/merchantKpis';
import type { MetricsRow } from '../lib/merchant/merchantKpis';
import { MockQiService } from '../lib/services/mock/mockQiService';

// Supabase mock: dados por tabela; registra as chamadas encadeadas.
const mockTableData: Record<string, unknown[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

jest.mock('../lib/supabase', () => {
  const chainMethods = ['select', 'eq', 'neq', 'order', 'gte', 'lte', 'lt', 'limit', 'in'];
  const buildQuery = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of chainMethods) {
      builder[method] = (...args: unknown[]) => {
        mockCalls.push({ table, method, args });
        return builder;
      };
    }
    builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: mockTableData[table] ?? [], error: null });
    return builder;
  };
  return { supabase: { from: (table: string) => buildQuery(table) } };
});

const now = new Date(2026, 4, 20, 12);
// Datas locais (mesma regra de janela da home).
const cur = (day: number) => new Date(2026, 4, day, 10).toISOString();
const prev = (day: number) => new Date(2026, 3, day, 10).toISOString();

function row(start: string, status: string, clientId: string | null): MetricsRow {
  return { start_time: start, status, client_id: clientId, service: { id: 1, name: 'Corte', price: 50 } };
}

const baseInput = {
  reviewRows: [],
  indicadosCount: 0,
  now,
  priorCurrent: new Set<string>(),
  priorPrevious: new Set<string>(),
};

describe('computeMerchantKpis', () => {
  it('counts confirmed/completed appointments with percent delta', () => {
    const rows = [
      row(cur(2), 'confirmed', 'a'),
      row(cur(3), 'completed', 'b'),
      row(cur(25), 'confirmed', 'c'),
      row(prev(5), 'completed', 'd'),
      row(prev(6), 'confirmed', 'e'),
    ];
    const kpis = computeMerchantKpis({ ...baseInput, rows });
    expect(kpis.agendamentos).toEqual({ value: '3', delta: { text: '+50%', up: true } });
  });

  it('ignores pending and canceled appointments in count and clients', () => {
    const rows = [
      row(cur(2), 'confirmed', 'a'),
      row(cur(3), 'pending', 'x'),
      row(cur(4), 'canceled', 'y'),
      row(prev(5), 'confirmed', 'd'),
    ];
    const kpis = computeMerchantKpis({ ...baseInput, rows });
    expect(kpis.agendamentos.value).toBe('1');
    expect(kpis.novosClientes.value).toBe('1');
    expect(monthClientIds(rows, now).current).toEqual(['a']);
  });

  it('averages ratings without delta and falls back to NO_RATING', () => {
    const withReviews = computeMerchantKpis({
      ...baseInput,
      rows: [],
      reviewRows: [{ rating: 5 }, { rating: 4 }, { rating: null }],
    });
    expect(withReviews.avaliacao).toEqual({ value: '4.5', delta: null });
    expect(computeMerchantKpis({ ...baseInput, rows: [] }).avaliacao).toEqual({
      value: NO_RATING,
      delta: null,
    });
    expect(NO_RATING).toBe('\u2014');
  });

  it('uses indicadosCount from QI without delta', () => {
    const kpis = computeMerchantKpis({ ...baseInput, rows: [], indicadosCount: 8 });
    expect(kpis.indicacoes).toEqual({ value: '8', delta: null });
  });

  it('counts new clients as the ones without prior appointments, with absolute delta', () => {
    const rows = [
      row(cur(2), 'confirmed', 'a'),
      row(cur(3), 'confirmed', 'b'),
      row(cur(4), 'confirmed', 'c'),
      row(prev(5), 'confirmed', 'd'),
      row(prev(6), 'confirmed', 'e'),
    ];
    const kpis = computeMerchantKpis({
      ...baseInput,
      rows,
      priorCurrent: new Set(['a']),
      priorPrevious: new Set(),
    });
    // computeDelta(2, 2) = { abs: 0, up: true }
    expect(kpis.novosClientes).toEqual({ value: '2', delta: { text: '0', up: true } });
  });

  it('accepts the service join as an array of one', () => {
    const rows: MetricsRow[] = [
      { start_time: cur(2), status: 'confirmed', client_id: 'a', service: [{ id: 1, name: 'Corte', price: 50 }] },
    ];
    expect(computeMerchantKpis({ ...baseInput, rows }).agendamentos.value).toBe('1');
  });

  it('returns zero without delta for an empty window', () => {
    const kpis = computeMerchantKpis({ ...baseInput, rows: [] });
    expect(kpis.agendamentos).toEqual({ value: '0', delta: null });
    expect(kpis.novosClientes).toEqual({ value: '0', delta: null });
  });

  it('exposes the home initial values', () => {
    expect(EMPTY_MERCHANT_KPIS).toEqual({
      agendamentos: { value: '0', delta: null },
      avaliacao: { value: NO_RATING, delta: null },
      indicacoes: { value: '0', delta: null },
      novosClientes: { value: '0', delta: null },
    });
  });
});

describe('monthWindows and monthClientIds', () => {
  it('builds local month windows', () => {
    const w = monthWindows(now);
    expect(w.startOfCurrentMonth).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
    expect(w.startOfPreviousMonth).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
    expect(w.endOfCurrentMonth).toEqual(new Date(2026, 4, 31, 23, 59, 59, 999));
  });

  it('splits distinct clients by month', () => {
    const rows = [
      row(cur(2), 'confirmed', 'a'),
      row(cur(3), 'confirmed', 'a'),
      row(cur(4), 'completed', 'b'),
      row(cur(5), 'confirmed', null),
      row(prev(5), 'confirmed', 'd'),
      row(prev(6), 'confirmed', 'd'),
    ];
    expect(monthClientIds(rows, now)).toEqual({ current: ['a', 'b'], previous: ['d'] });
  });
});

describe('loadMerchantKpis', () => {
  beforeEach(() => {
    mockCalls.length = 0;
    for (const key of Object.keys(mockTableData)) delete mockTableData[key];
  });

  it('queries the business appointments, reviews and QI summary', async () => {
    mockTableData.appointments = [row(cur(2), 'confirmed', 'a'), row(prev(5), 'confirmed', 'd')];
    mockTableData.reviews = [{ rating: 5 }, { rating: 4 }];
    const qi = new MockQiService();
    const summarySpy = jest.spyOn(qi, 'getQiSummary');

    const kpis = await loadMerchantKpis(42, qi, now);

    expect(summarySpy).toHaveBeenCalledWith('merchant');
    const businessFilters = mockCalls.filter((c) => c.method === 'eq' && c.args[0] === 'business_id');
    expect(new Set(businessFilters.map((c) => c.table))).toEqual(new Set(['appointments', 'reviews']));
    expect(businessFilters.every((c) => c.args[1] === 42)).toBe(true);

    const { indicadosCount } = await qi.getQiSummary('merchant');
    // O mock devolve as mesmas linhas para a consulta de clientes anteriores:
    // 'a' e 'd' contam como já atendidos, então nenhum é novo.
    expect(kpis).toEqual(
      computeMerchantKpis({
        rows: mockTableData.appointments as MetricsRow[],
        reviewRows: [{ rating: 5 }, { rating: 4 }],
        indicadosCount,
        now,
        priorCurrent: new Set(['a', 'd']),
        priorPrevious: new Set(['a', 'd']),
      }),
    );
    expect(kpis.novosClientes.value).toBe('0');
    expect(kpis.avaliacao.value).toBe('4.5');
  });
});
