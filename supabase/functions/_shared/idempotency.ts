/**
 * Chaves determinísticas para o header `Idempotency-Key` das chamadas POST à
 * Stripe (design § 11). Mesma entrada, mesma chave: um retry da Edge Function
 * nunca cria um segundo objeto. Puro.
 */

function requireId(id: string | number, label: string): string {
  const value = String(id);
  if (value.length === 0) {
    throw new Error(`${label} vazio na chave de idempotência.`);
  }
  return value;
}

export const idempotencyKeys = {
  paymentIntent: (paymentId: string) => `pi:${requireId(paymentId, 'paymentId')}`,
  confirm: (paymentId: string, attempt: number) => {
    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new Error('A tentativa deve ser um inteiro >= 1.');
    }
    return `confirm:${requireId(paymentId, 'paymentId')}:${attempt}`;
  },
  /** Saque com vários transfers (um por cobrança alocada): `part` = id da alocação. */
  transfer: (withdrawalId: string, part?: number) =>
    part === undefined
      ? `transfer:${requireId(withdrawalId, 'withdrawalId')}`
      : `transfer:${requireId(withdrawalId, 'withdrawalId')}:${requireId(part, 'part')}`,
  payout: (withdrawalId: string) => `payout:${requireId(withdrawalId, 'withdrawalId')}`,
  reversal: (withdrawalId: string) => `reversal:${requireId(withdrawalId, 'withdrawalId')}`,
  account: (businessId: number) => `acct:${requireId(businessId, 'businessId')}`,
  customer: (userId: string) => `cus:${requireId(userId, 'userId')}`,
  /** Cancelamento do PI de uma cobrança não paga (`payments-cancel`). */
  cancel: (paymentId: string) => `cancel:${requireId(paymentId, 'paymentId')}`,
} as const;
