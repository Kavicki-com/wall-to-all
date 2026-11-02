import { formatClock, formatCompactCount, formatPostMeta } from '../lib/feed/format';

describe('formatCompactCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1k'],
    [1250, '1,2k'],
    [45200, '45,2k'],
    [999999, '999,9k'],
    [1500000, '1,5 mi'],
    [2000000, '2 mi'],
  ])('%d vira %s', (input, expected) => {
    expect(formatCompactCount(input)).toBe(expected);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [24, '00:24'],
    [30, '00:30'],
    [75, '01:15'],
  ])('%d segundos vira %s', (input, expected) => {
    expect(formatClock(input)).toBe(expected);
  });
});

describe('formatPostMeta', () => {
  const createdAt = '2026-05-12T15:00:00.000Z';

  it('junta serviço vinculado e data curta', () => {
    expect(
      formatPostMeta({
        linkedService: { serviceId: 1, name: 'Corte feminino', priceCents: 8000, durationMinutes: 60 },
        createdAt,
      }),
    ).toBe('Corte feminino · 12 mai');
  });

  it('sem serviço mostra só a data', () => {
    expect(formatPostMeta({ linkedService: null, createdAt })).toBe('12 mai');
  });
});
