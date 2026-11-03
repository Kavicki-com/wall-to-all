import { formatSubscriptionDate } from '../lib/subscription/formatDate';

describe('formatSubscriptionDate', () => {
  it('formats as day, short lowercase month and year', () => {
    expect(formatSubscriptionDate('2026-06-14T12:00:00.000Z')).toBe('14 jun 2026');
  });

  it('does not pad the day', () => {
    expect(formatSubscriptionDate('2026-05-04T12:00:00.000Z')).toBe('4 mai 2026');
  });

  it('uses pt-BR month abbreviations without the device locale', () => {
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    months.forEach((month, index) => {
      const iso = `2026-${String(index + 1).padStart(2, '0')}-14T12:00:00.000Z`;
      expect(formatSubscriptionDate(iso)).toBe(`14 ${month} 2026`);
    });
  });

  it('throws on an invalid ISO string', () => {
    expect(() => formatSubscriptionDate('not-a-date')).toThrow();
  });
});
