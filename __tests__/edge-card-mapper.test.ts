import {
  mapCard,
  mapCards,
  type StripeCardPaymentMethod,
} from '../supabase/functions/_shared/cardMapper.ts';

type CardOverrides = Partial<Omit<StripeCardPaymentMethod, 'card'>> & {
  card?: Partial<NonNullable<StripeCardPaymentMethod['card']>>;
};

function pm(overrides: CardOverrides = {}): StripeCardPaymentMethod {
  const { card, ...rest } = overrides;
  return {
    id: 'pm_test_visa',
    billing_details: { name: 'Maria Silva' },
    ...rest,
    card: {
      brand: 'visa',
      display_brand: 'visa',
      last4: '4242',
      exp_month: 8,
      exp_year: 2028,
      ...card,
    },
  };
}

describe('cardMapper (edge _shared)', () => {
  it('mapeia um PaymentMethod Visa para PaymentCard', () => {
    expect(mapCard(pm(), null)).toEqual({
      id: 'pm_test_visa',
      brand: 'visa',
      last4: '4242',
      expiry: '08/28',
      holderName: 'MARIA SILVA',
      isDefault: false,
    });
  });

  it('sem nome no billing_details usa string vazia', () => {
    expect(mapCard(pm({ billing_details: { name: null } }), null)?.holderName).toBe('');
  });

  it('mapeia Mastercard, Amex e Elo', () => {
    expect(
      mapCard(pm({ card: { brand: 'mastercard', display_brand: 'mastercard' } }), null)?.brand,
    ).toBe('mastercard');
    expect(
      mapCard(pm({ card: { brand: 'amex', display_brand: 'american_express' } }), null)?.brand,
    ).toBe('amex');
    // Elo pode vir só no display_brand (a rede de cobrança é outra).
    expect(mapCard(pm({ card: { brand: 'unknown', display_brand: 'elo' } }), null)?.brand).toBe(
      'elo',
    );
  });

  it('bandeira fora de CardBrand é filtrada', () => {
    expect(mapCard(pm({ card: { brand: 'jcb', display_brand: 'jcb' } }), null)).toBeNull();
    const list = mapCards(
      [
        pm({ id: 'pm_a' }),
        pm({ id: 'pm_b', card: { brand: 'discover', display_brand: 'discover' } }),
      ],
      null,
    );
    expect(list.map((c) => c.id)).toEqual(['pm_a']);
  });

  it('default vem de invoice_settings.default_payment_method', () => {
    const list = mapCards([pm({ id: 'pm_a' }), pm({ id: 'pm_b' })], 'pm_b');
    expect(list.find((c) => c.id === 'pm_b')?.isDefault).toBe(true);
    expect(list.find((c) => c.id === 'pm_a')?.isDefault).toBe(false);
  });

  it('PaymentMethod sem card é ignorado', () => {
    const noCard: StripeCardPaymentMethod = {
      id: 'pm_pix',
      billing_details: { name: null },
      card: null,
    };
    expect(mapCards([noCard], null)).toEqual([]);
  });
});
