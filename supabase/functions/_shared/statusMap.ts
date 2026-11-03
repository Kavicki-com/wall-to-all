/**
 * Status do PaymentIntent da Stripe -> `payment_status` do banco, e a regra
 * de transição que torna o webhook tolerante a eventos fora de ordem
 * (design § 11). Puro.
 */

export type PaymentStatus =
  | 'requires_payment'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'pay_on_site';

const INTENT_STATUS: Record<string, PaymentStatus> = {
  requires_payment_method: 'requires_payment',
  requires_confirmation: 'requires_payment',
  requires_action: 'requires_action',
  processing: 'processing',
  requires_capture: 'processing',
  succeeded: 'succeeded',
  canceled: 'canceled',
};

export function paymentStatusFromIntent(intentStatus: string): PaymentStatus {
  const status = INTENT_STATUS[intentStatus];
  if (!status) {
    throw new Error(`Status de PaymentIntent desconhecido: ${intentStatus}`);
  }
  return status;
}

/** Ordem dos estados em andamento: só avança. */
const PENDING_RANK: Partial<Record<PaymentStatus, number>> = {
  requires_payment: 0,
  requires_action: 1,
  processing: 2,
};

const FINAL: ReadonlySet<PaymentStatus> = new Set(['canceled', 'refunded', 'pay_on_site']);

/**
 * Se a linha em `payments` pode ir de `from` para `to`. Mesmo status não é
 * transição (o webhook trata como no-op).
 */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  if (FINAL.has(from)) return false;
  // pay_on_site só nasce pelo RPC record_pay_on_site, nunca por transição.
  if (to === 'pay_on_site') return false;
  if (from === 'succeeded') return to === 'refunded';
  if (to === 'refunded') return false;
  // Cartão recusado: o mesmo PI é reconfirmado com outro cartão.
  if (from === 'failed') return true;
  if (to === 'succeeded' || to === 'failed' || to === 'canceled') return true;
  return (PENDING_RANK[to] ?? -1) > (PENDING_RANK[from] ?? -1);
}
