/**
 * Escolha do modelo de fundos de cada cobrança (design § 3). Puro.
 *
 * - `destination`: PaymentIntent com `transfer_data[destination]`; a Stripe
 *   repassa o líquido para a conta conectada no ato (modelo A).
 * - `platform`: o dinheiro fica na plataforma, o ledger credita o lojista e o
 *   repasse acontece depois por `transfer` (modelo B).
 * - `none`: sem PSP (pagar na hora).
 */

export type FundsFlow = 'destination' | 'platform' | 'none';
export type PaymentPurposeKind = 'booking' | 'fura_fila' | 'subscription';
/** Como o cliente vai pagar; `pay_on_site` não passa pela Stripe. */
export type SettlementMethod = 'card' | 'pix' | 'pay_on_site';

export interface FundsFlowInput {
  purpose: PaymentPurposeKind;
  method: SettlementMethod;
  /** Conta conectada do lojista; null quando não há. */
  merchantAccount: { payoutsEnabled: boolean } | null;
}

/** O que o spike (Task 1) confirmou na API da Stripe. */
export interface FundsFlowCapabilities {
  pixDestinationSupported: boolean;
}

export function chooseFundsFlow(input: FundsFlowInput, caps: FundsFlowCapabilities): FundsFlow {
  if (input.method === 'pay_on_site') return 'none';
  // Fura-fila: lojista é fixture, sem conta conectada. Assinatura: receita da plataforma.
  if (input.purpose !== 'booking') return 'platform';
  if (!input.merchantAccount?.payoutsEnabled) return 'platform';
  if (input.method === 'pix' && !caps.pixDestinationSupported) return 'platform';
  return 'destination';
}
