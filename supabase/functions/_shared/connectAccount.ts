/**
 * Parâmetros da conta conectada e do Account Link (design § 9 e § 16). Puro.
 *
 * Spike (g): contas novas só pela Accounts v2 (`POST /v2/core/accounts`, JSON),
 * e `recipient.stripe_transfers` exige também `merchant.card_payments`. O
 * Account Link continua v1 e aceita a conta v2. No BR o payout é automático
 * (manual é proibido), por isso não há configuração de payout aqui.
 */

export interface V2AccountInput {
  businessId: number;
  email: string | null;
  displayName: string | null;
}

export function v2AccountBody(input: V2AccountInput) {
  const email = input.email?.trim();
  if (!email) throw new Error('contact_email é obrigatório na Accounts v2.');
  const name = input.displayName?.trim() || `Negócio ${input.businessId}`;
  return {
    contact_email: email,
    display_name: name,
    identity: { country: 'br' },
    dashboard: 'express',
    defaults: {
      responsibilities: { fees_collector: 'application', losses_collector: 'application' },
    },
    configuration: {
      merchant: { capabilities: { card_payments: { requested: true } } },
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
    },
    metadata: { business_id: String(input.businessId) },
  };
}

/** `return_url`/`refresh_url` do Account Link: precisam ser https. */
export function accountLinkUrls(baseUrl: string): { return_url: string; refresh_url: string } {
  const base = baseUrl.replace(/\/+$/, '');
  if (!base.startsWith('https://')) {
    throw new Error('CONNECT_RETURN_BASE_URL precisa ser https.');
  }
  return {
    return_url: `${base}?state=done`,
    refresh_url: `${base}?state=refresh`,
  };
}
