import { paymentStatusFromIntent, canTransition } from '../supabase/functions/_shared/statusMap.ts';
import { idempotencyKeys } from '../supabase/functions/_shared/idempotency.ts';

describe('statusMap (edge _shared)', () => {
  it.each([
    ['requires_payment_method', 'requires_payment'],
    ['requires_confirmation', 'requires_payment'],
    ['requires_action', 'requires_action'],
    ['processing', 'processing'],
    ['requires_capture', 'processing'],
    ['succeeded', 'succeeded'],
    ['canceled', 'canceled'],
  ])('PaymentIntent %s vira %s', (pi, expected) => {
    expect(paymentStatusFromIntent(pi)).toBe(expected);
  });

  it('status desconhecido lança', () => {
    expect(() => paymentStatusFromIntent('weird')).toThrow();
  });

  describe('canTransition', () => {
    it('avança no fluxo normal', () => {
      expect(canTransition('requires_payment', 'requires_action')).toBe(true);
      expect(canTransition('requires_action', 'processing')).toBe(true);
      expect(canTransition('processing', 'succeeded')).toBe(true);
      expect(canTransition('processing', 'failed')).toBe(true);
      expect(canTransition('requires_action', 'canceled')).toBe(true);
    });

    it('nunca volta de succeeded, exceto para refunded', () => {
      expect(canTransition('succeeded', 'processing')).toBe(false);
      expect(canTransition('succeeded', 'failed')).toBe(false);
      expect(canTransition('succeeded', 'canceled')).toBe(false);
      expect(canTransition('succeeded', 'refunded')).toBe(true);
    });

    it('ignora evento atrasado de estado anterior', () => {
      expect(canTransition('processing', 'requires_action')).toBe(false);
      expect(canTransition('requires_action', 'requires_payment')).toBe(false);
    });

    it('cartão recusado pode ser tentado de novo no mesmo PI', () => {
      expect(canTransition('failed', 'requires_action')).toBe(true);
      expect(canTransition('failed', 'processing')).toBe(true);
      expect(canTransition('failed', 'succeeded')).toBe(true);
      expect(canTransition('failed', 'canceled')).toBe(true);
    });

    it('estados finais não mudam', () => {
      for (const to of [
        'requires_payment',
        'processing',
        'succeeded',
        'failed',
        'canceled',
      ] as const) {
        expect(canTransition('canceled', to)).toBe(false);
        expect(canTransition('refunded', to)).toBe(false);
        expect(canTransition('pay_on_site', to)).toBe(false);
      }
    });

    it('refunded só a partir de succeeded; pay_on_site nunca por transição', () => {
      expect(canTransition('processing', 'refunded')).toBe(false);
      expect(canTransition('requires_payment', 'pay_on_site')).toBe(false);
    });

    it('mesmo status não é transição', () => {
      expect(canTransition('processing', 'processing')).toBe(false);
    });
  });
});

describe('idempotencyKeys (edge _shared)', () => {
  it('gera chaves determinísticas por objeto', () => {
    expect(idempotencyKeys.paymentIntent('p1')).toBe('pi:p1');
    expect(idempotencyKeys.confirm('p1', 2)).toBe('confirm:p1:2');
    expect(idempotencyKeys.transfer('w1')).toBe('transfer:w1');
    expect(idempotencyKeys.payout('w1')).toBe('payout:w1');
    expect(idempotencyKeys.reversal('w1')).toBe('reversal:w1');
    expect(idempotencyKeys.account(42)).toBe('acct:42');
    expect(idempotencyKeys.customer('u1')).toBe('cus:u1');
    expect(idempotencyKeys.cancel('p1')).toBe('cancel:p1');
  });

  it('repetir a chamada devolve a mesma chave', () => {
    expect(idempotencyKeys.confirm('p1', 1)).toBe(idempotencyKeys.confirm('p1', 1));
  });

  it('rejeita id vazio e tentativa inválida', () => {
    expect(() => idempotencyKeys.paymentIntent('')).toThrow();
    expect(() => idempotencyKeys.confirm('p1', 0)).toThrow();
    expect(() => idempotencyKeys.confirm('p1', 1.5)).toThrow();
  });
});
