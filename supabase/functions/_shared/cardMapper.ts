/**
 * PaymentMethod de cartão da Stripe -> `PaymentCard` do app
 * (`lib/services/types.ts`). Puro: coberto por `__tests__/edge-card-mapper.test.ts`.
 *
 * O bundle da Edge Function não enxerga `lib/`, então os tipos do app são
 * espelhados aqui.
 */

/** Espelho de `CardBrand` em `lib/services/types.ts`. */
export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex';

/** Espelho de `PaymentCard` em `lib/services/types.ts`. */
export interface PaymentCard {
  id: string;
  brand: CardBrand;
  last4: string;
  holderName: string;
  /** MM/YY */
  expiry: string;
  isDefault: boolean;
}

/** Recorte do PaymentMethod da Stripe que o mapper lê. */
export interface StripeCardPaymentMethod {
  id: string;
  billing_details: { name: string | null };
  card: {
    brand: string;
    display_brand?: string | null;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
}

const BRANDS: Record<string, CardBrand> = {
  visa: 'visa',
  mastercard: 'mastercard',
  amex: 'amex',
  american_express: 'amex',
  elo: 'elo',
};

function brandOf(card: NonNullable<StripeCardPaymentMethod['card']>): CardBrand | null {
  // display_brand primeiro: cartões Elo podem ter outra rede em `brand`.
  return BRANDS[card.display_brand ?? ''] ?? BRANDS[card.brand] ?? null;
}

function pad2(value: number): string {
  return String(value % 100).padStart(2, '0');
}

/** Null quando não é cartão ou a bandeira não existe no app. */
export function mapCard(
  pm: StripeCardPaymentMethod,
  defaultPaymentMethodId: string | null,
): PaymentCard | null {
  if (!pm.card) return null;
  const brand = brandOf(pm.card);
  if (!brand) return null;
  return {
    id: pm.id,
    brand,
    last4: pm.card.last4,
    expiry: `${pad2(pm.card.exp_month)}/${pad2(pm.card.exp_year)}`,
    holderName: (pm.billing_details.name ?? '').toUpperCase(),
    isDefault: pm.id === defaultPaymentMethodId,
  };
}

export function mapCards(
  pms: StripeCardPaymentMethod[],
  defaultPaymentMethodId: string | null,
): PaymentCard[] {
  return pms
    .map((pm) => mapCard(pm, defaultPaymentMethodId))
    .filter((card): card is PaymentCard => card !== null);
}
