/**
 * Escolha do modelo de fundos de cada cobrança (design § 3). Puro.
 *
 * - `platform`: o dinheiro fica na plataforma, o ledger credita o lojista e o
 *   repasse acontece no "Sacar" por `transfer` com `source_transaction`.
 * - `none`: sem PSP (pagar na hora).
 * - `destination` (destination charge) existe no enum do banco, mas não é
 *   usado: decisão do design § 16 (02/11), a plataforma segura todos os
 *   fundos (no BR todo transfer exige `source_transaction` e o payout manual é
 *   proibido, então o saque sob demanda só funciona com o saldo na plataforma).
 */

export type FundsFlow = 'destination' | 'platform' | 'none';
export type PaymentPurposeKind = 'booking' | 'fura_fila' | 'subscription';
/** Como o cliente vai pagar; `pay_on_site` não passa pela Stripe. */
export type SettlementMethod = 'card' | 'pix' | 'pay_on_site';

export interface FundsFlowInput {
  purpose: PaymentPurposeKind;
  method: SettlementMethod;
}

export function chooseFundsFlow(input: FundsFlowInput): FundsFlow {
  return input.method === 'pay_on_site' ? 'none' : 'platform';
}
