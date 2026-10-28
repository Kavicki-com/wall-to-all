import { priceToCents } from '../lib/booking/money';

describe('priceToCents', () => {
  it('converts reais to integer cents', () => {
    expect(priceToCents(65)).toBe(6500);
    expect(priceToCents(115.1)).toBe(11510);
  });

  it('rounds floating point noise', () => {
    expect(priceToCents(0.07 * 3)).toBe(21);
    expect(Number.isInteger(priceToCents(19.99))).toBe(true);
  });
});
