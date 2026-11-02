/**
 * Conta conectada da Stripe (leitura v1, que funciona também para contas
 * criadas pela Accounts v2, ver design § 16) -> flags de `merchant_accounts`.
 * Puro.
 */

export interface StripeAccountShape {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
  } | null;
}

export interface AccountFlags {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Pendências atuais e vencidas, sem repetição. */
  requirementsDue: string[];
}

export function accountFlags(account: StripeAccountShape): AccountFlags {
  const due = [
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.past_due ?? []),
  ];
  return {
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true,
    requirementsDue: [...new Set(due)],
  };
}
