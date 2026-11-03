import { newCheckoutKey } from '../lib/payments/checkoutKey';

describe('newCheckoutKey', () => {
  it('prefixo chk_ e chaves distintas', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newCheckoutKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(/^chk_[A-Za-z0-9]{16,}$/);
  });
});
