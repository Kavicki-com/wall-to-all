import {
  computeMonthOverview,
  groupRevenueByService,
  computeDelta,
  priceTier,
} from '../lib/dashboardMetrics';

describe('computeMonthOverview', () => {
  it('usa a receita do mês anterior como meta e calcula faltam/percentual', () => {
    const o = computeMonthOverview({ currentRevenue: 4250, previousRevenue: 6000, dayOfMonth: 22, daysInMonth: 31 });
    expect(o).toEqual({ forecast: 6000, realized: 4250, remaining: 1750, pct: 71, onTrack: true });
    // onTrack: 71% realizado ≥ 71% do mês decorrido (22/31 ≈ 71%).
  });
  it('marca fora do ritmo quando o % realizado fica abaixo do % do mês decorrido', () => {
    const o = computeMonthOverview({ currentRevenue: 1000, previousRevenue: 6000, dayOfMonth: 22, daysInMonth: 31 });
    expect(o!.onTrack).toBe(false);
  });
  it('retorna null sem receita no mês anterior (sem meta → estado neutro)', () => {
    expect(computeMonthOverview({ currentRevenue: 500, previousRevenue: 0, dayOfMonth: 5, daysInMonth: 30 })).toBeNull();
  });
});

describe('groupRevenueByService', () => {
  it('agrupa receita por serviço, ordena desc e agrega a cauda em "Outros" (máx. 3 + Outros)', () => {
    const rows = [
      { serviceName: 'Corte feminino', amount: 1912 },
      { serviceName: 'Corte masculino', amount: 1062 },
      { serviceName: 'Escovas', amount: 850 },
      { serviceName: 'Barba', amount: 300 },
      { serviceName: 'Sobrancelha', amount: 125 },
      { serviceName: 'Corte feminino', amount: 1 }, // soma no mesmo serviço
    ];
    const g = groupRevenueByService(rows);
    expect(g.total).toBe(4250);
    expect(g.segments.map((s) => s.label)).toEqual(['Corte feminino', 'Corte masculino', 'Escovas', 'Outros']);
    expect(g.segments[3].amount).toBe(425); // 300 + 125
    expect(g.segments[0].pct).toBe(45); // 1913/4250 ≈ 45
  });
  it('retorna total 0 e sem segmentos para lista vazia', () => {
    expect(groupRevenueByService([])).toEqual({ total: 0, segments: [] });
  });
});

describe('computeDelta', () => {
  it('variação absoluta e percentual vs período anterior', () => {
    expect(computeDelta(24, 21)).toEqual({ abs: 3, pct: 14, up: true });
    expect(computeDelta(18, 24)).toEqual({ abs: -6, pct: -25, up: false });
  });
  it('null quando não há base de comparação (prev 0/undefined)', () => {
    expect(computeDelta(10, 0)).toBeNull();
    expect(computeDelta(10, undefined)).toBeNull();
  });
});

describe('priceTier', () => {
  it('bucketiza a média de preços em 1..5 cifrões', () => {
    expect(priceTier([30, 40])).toBe(1);
    expect(priceTier([80])).toBe(2);
    expect(priceTier([120, 140])).toBe(3);
    expect(priceTier([200])).toBe(4);
    expect(priceTier([400])).toBe(5);
  });
  it('null sem preços', () => {
    expect(priceTier([])).toBeNull();
  });
});
