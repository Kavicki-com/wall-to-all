/**
 * Evento da Stripe -> operações do webhook (design § 10). Puro: o handler
 * (`stripe-webhook/index.ts`) só carrega o contexto, executa o plano e
 * registra o evento.
 *
 * O webhook é a fonte da verdade do pagamento: é aqui que `payments.status`
 * vira `succeeded` e que o ledger credita o lojista.
 *
 * Design § 16: `payout.*` não muda saque (o saque conclui no transfer, e o
 * payout para o banco é o automático da Stripe). Eventos sem efeito voltam
 * como `ignore` e o handler responde 200.
 */

import { accountFlags, type AccountFlags, type StripeAccountShape } from './accountFlags.ts';
import {
  entriesForRefund,
  entriesForSucceeded,
  type LedgerEntryDraft,
  type SettledPayment,
} from './ledger.ts';
import { canTransition, type PaymentStatus } from './statusMap.ts';

/** Recorte do evento que o webhook lê. */
export interface StripeEventShape {
  id: string;
  type: string;
  /** Presente nos eventos do endpoint Connect. */
  account?: string | null;
  data: { object: Record<string, unknown> };
}

/** Linha de `payments` com o que o plano precisa (o handler monta). */
export interface PaymentContext extends SettledPayment {
  status: PaymentStatus;
  method: 'card' | 'pix' | 'cash';
  appointmentId: number | null;
  /** Dono do negócio (destino da notificação de agendamento). */
  merchantOwnerId: string | null;
  appointmentStartTime: string | null;
}

export interface WebhookContext {
  payment: PaymentContext | null;
  /** Cartão do `latest_charge` (o handler busca só no succeeded de cartão). */
  charge: { last4: string | null; brand: string | null } | null;
  /** Só test mode: negócio que recebe a parte do lojista no fura-fila. */
  demoBusinessId: number | null;
}

export interface MerchantNotification {
  userId: string;
  appointmentId: number;
  type: 'appointment_requested';
  title: string;
  message: string;
}

export type WebhookPlan =
  | { kind: 'ignore'; reason: 'unhandled_type' | 'unknown_payment' | 'stale' | 'partial_refund' }
  | {
      kind: 'payment';
      paymentId: string;
      status: PaymentStatus;
      /** `p_fields` do `apply_payment_event`. */
      fields: Record<string, string>;
      ledger: LedgerEntryDraft[];
      cancelAppointment: boolean;
      /** Enviada só se o evento for aplicado agora (não em reenvio). */
      notifyMerchant: MerchantNotification | null;
    }
  | {
      kind: 'account';
      accountId: string;
      flags: AccountFlags | null;
      disconnected: boolean;
    };

const INTENT_EVENT_STATUS: Record<string, PaymentStatus> = {
  'payment_intent.succeeded': 'succeeded',
  'payment_intent.processing': 'processing',
  'payment_intent.requires_action': 'requires_action',
  'payment_intent.payment_failed': 'failed',
  'payment_intent.canceled': 'canceled',
};

/** Como achar a linha em `payments` para o evento; null quando não se aplica. */
export function paymentLookup(
  event: StripeEventShape,
): { paymentId: string } | { providerPaymentId: string } | null {
  const obj = event.data.object;
  if (event.type.startsWith('payment_intent.')) {
    const metadata = obj.metadata as Record<string, string> | null | undefined;
    const paymentId = metadata?.payment_id;
    return paymentId ? { paymentId } : null;
  }
  if (event.type === 'charge.refunded') {
    const pi = obj.payment_intent;
    return typeof pi === 'string' && pi ? { providerPaymentId: pi } : null;
  }
  return null;
}

const SAO_PAULO = 'America/Sao_Paulo';

/** Mesma copy de `notifyAppointmentRequested` (`lib/notifications.ts`). */
export function appointmentRequestedMessage(
  clientName: string,
  serviceName: string,
  startTime: string,
): string {
  const date = new Date(startTime);
  const day = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: SAO_PAULO,
  });
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAO_PAULO,
  });
  return `${clientName} solicitou um agendamento para ${serviceName} no dia ${day} às ${time}.`;
}

function notificationFor(payment: PaymentContext): MerchantNotification | null {
  if (
    payment.purpose !== 'booking' ||
    !payment.merchantOwnerId ||
    payment.appointmentId === null ||
    !payment.appointmentStartTime
  ) {
    return null;
  }
  return {
    userId: payment.merchantOwnerId,
    appointmentId: payment.appointmentId,
    type: 'appointment_requested',
    title: 'Nova Solicitação de Agendamento',
    message: appointmentRequestedMessage(
      payment.payerName,
      payment.serviceName ?? 'Serviço',
      payment.appointmentStartTime,
    ),
  };
}

function planIntentEvent(
  event: StripeEventShape,
  status: PaymentStatus,
  ctx: WebhookContext,
): WebhookPlan {
  const payment = ctx.payment;
  if (!payment) return { kind: 'ignore', reason: 'unknown_payment' };
  if (!canTransition(payment.status, status)) return { kind: 'ignore', reason: 'stale' };

  const obj = event.data.object;
  const fields: Record<string, string> = { provider_payment_id: String(obj.id) };
  let ledger: LedgerEntryDraft[] = [];
  let notifyMerchant: MerchantNotification | null = null;

  if (status === 'succeeded') {
    if (ctx.charge?.last4) fields.card_last4 = ctx.charge.last4;
    if (ctx.charge?.brand) fields.card_brand = ctx.charge.brand;
    ledger = entriesForSucceeded(payment, { demoBusinessId: ctx.demoBusinessId });
    notifyMerchant = notificationFor(payment);
  }
  if (status === 'failed') {
    const err = obj.last_payment_error as
      | { code?: string | null; decline_code?: string | null }
      | null
      | undefined;
    fields.failure_code = err?.decline_code ?? err?.code ?? 'payment_failed';
  }

  return {
    kind: 'payment',
    paymentId: payment.id,
    status,
    fields,
    ledger,
    cancelAppointment: status === 'canceled' && payment.purpose === 'booking',
    notifyMerchant,
  };
}

export function planForEvent(event: StripeEventShape, ctx: WebhookContext): WebhookPlan {
  const intentStatus = INTENT_EVENT_STATUS[event.type];
  if (intentStatus) return planIntentEvent(event, intentStatus, ctx);

  if (event.type === 'charge.refunded') {
    const payment = ctx.payment;
    if (!payment) return { kind: 'ignore', reason: 'unknown_payment' };
    if (event.data.object.refunded !== true) return { kind: 'ignore', reason: 'partial_refund' };
    if (!canTransition(payment.status, 'refunded')) return { kind: 'ignore', reason: 'stale' };
    return {
      kind: 'payment',
      paymentId: payment.id,
      status: 'refunded',
      fields: {},
      ledger: entriesForRefund(payment, { demoBusinessId: ctx.demoBusinessId }),
      cancelAppointment: false,
      notifyMerchant: null,
    };
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as unknown as StripeAccountShape;
    return {
      kind: 'account',
      accountId: account.id,
      flags: accountFlags(account),
      disconnected: false,
    };
  }

  if (event.type === 'account.application.deauthorized' && event.account) {
    return { kind: 'account', accountId: event.account, flags: null, disconnected: true };
  }

  return { kind: 'ignore', reason: 'unhandled_type' };
}

/** Lançamentos no formato do `p_ledger` do `apply_payment_event`. */
export function ledgerToRpc(entries: LedgerEntryDraft[]) {
  return entries.map((e) => ({
    account: e.account,
    kind: e.kind,
    amount_cents: e.amountCents,
    business_id: e.businessId,
    user_id: e.userId,
    withdrawal_id: e.withdrawalId,
    title: e.title,
    subtitle: e.subtitle,
  }));
}
