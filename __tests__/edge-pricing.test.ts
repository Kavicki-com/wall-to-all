import {
  priceToCents,
  platformFeeCents,
  quoteWithdraw,
  MIN_WITHDRAW_CENTS,
} from '../supabase/functions/_shared/pricing.ts';
import { priceToCents as appPriceToCents } from '../lib/booking/money';
import {
  computeWithdrawQuote,
  MIN_WITHDRAW_CENTS as APP_MIN_WITHDRAW_CENTS,
} from '../lib/services/mock/withdrawQuote';

describe('pricing (edge _shared)', () => {
  describe('priceToCents', () => {
    it('converte reais em centavos', () => {
      expect(priceToCents(65)).toBe(6500);
      expect(priceToCents(115.1)).toBe(11510);
    });

    it('tem paridade com o helper do app (lib/booking/money)', () => {
      for (const price of [0.01, 1, 19.99, 65, 115.1, 249.9, 1000.05]) {
        expect(priceToCents(price)).toBe(appPriceToCents(price));
      }
    });

    it('rejeita preço negativo ou não finito', () => {
      expect(() => priceToCents(-1)).toThrow();
      expect(() => priceToCents(Number.NaN)).toThrow();
      expect(() => priceToCents(Number.POSITIVE_INFINITY)).toThrow();
    });
  });

  describe('platformFeeCents', () => {
    it('aplica basis points', () => {
      expect(platformFeeCents(6500, 1000)).toBe(650);
    });

    it('bps 0 não cobra taxa', () => {
      expect(platformFeeCents(6500, 0)).toBe(0);
    });

    it('arredonda para baixo, a favor do lojista', () => {
      // 1999 * 1000 / 10000 = 199.9
      expect(platformFeeCents(1999, 1000)).toBe(199);
      // 333 * 333 / 10000 = 11.0889
      expect(platformFeeCents(333, 333)).toBe(11);
    });

    it('lança para valor não inteiro ou fora da faixa', () => {
      expect(() => platformFeeCents(65.5, 1000)).toThrow();
      expect(() => platformFeeCents(0, 1000)).toThrow();
      expect(() => platformFeeCents(6500, 10.5)).toThrow();
      expect(() => platformFeeCents(6500, -1)).toThrow();
      expect(() => platformFeeCents(6500, 10001)).toThrow();
    });
  });

  describe('quoteWithdraw', () => {
    it.each([3000, 19999, 20000, 59120])(
      'cota %i igual ao computeWithdrawQuote do app',
      (amount) => {
        expect(quoteWithdraw(amount)).toEqual(computeWithdrawQuote(amount));
      },
    );

    it('usa o mesmo mínimo do app', () => {
      expect(MIN_WITHDRAW_CENTS).toBe(APP_MIN_WITHDRAW_CENTS);
    });

    it('lança para valor não inteiro ou não positivo', () => {
      expect(() => quoteWithdraw(100.5)).toThrow();
      expect(() => quoteWithdraw(0)).toThrow();
      expect(() => quoteWithdraw(-100)).toThrow();
    });
  });
});
