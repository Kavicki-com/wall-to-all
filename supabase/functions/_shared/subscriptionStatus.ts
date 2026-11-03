/**
 * Assinatura do lojista no Stripe Billing -> domínio do app (F7). Puro: a
 * Edge Function `subscriptions` e o `stripe-webhook` usam estas regras, e o
 * jest as testa sem rede nem banco.
 *
 * Os tipos espelham `lib/services/subscriptionTypes.ts` (o app não é
 * importado daqui, como em `cardMapper.ts`). Na API `2026-10-28.endive` o fim
 * do período fica no item da assinatura e a fatura aponta para a assinatura
 * por `parent.subscription_details`; os campos antigos ficam como fallback.
 */

import { mapCard, type CardBrand, type StripeCardPaymentMethod } from './cardMapper.ts';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete';

export interface SubscriptionCard {
  id: string;
  brand: CardBrand;
  last4: string;
}

export interface Subscription {
  id: string;
  planId: string;
  priceCents: number;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  /** ISO 8601. */
  currentPeriodEnd: string;
  card: SubscriptionCard | null;
}

export interface SubscriptionInvoice {
  id: string;
  amountCents: number;
  status: 'paid' | 'open';
  /** ISO 8601 da emissão. */
  createdAt: string;
}

/** Recorte da assinatura da Stripe que estas regras leem. */
export interface StripeSubscriptionShape {
  id: string;
  status: string;
  created: number;
  cancel_at_period_end: boolean;
  customer: string | { id: string };
  metadata: Record<string, string>;
  /** API antiga; na atual o fim do período vem do item. */
  current_period_end?: number;
  items: {
    data: Array<{
      current_period_end?: number;
      price: { id: string; unit_amount: number | null };
    }>;
  };
}

/** Recorte da fatura da Stripe que estas regras leem. */
export interface StripeInvoiceShape {
  id: string;
  status: string | null;
  total: number;
  created: number;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  /** API antiga. */
  subscription?: string | { id: string } | null;
}

const STATUS: Record<string, SubscriptionStatus> = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  paused: 'past_due',
  incomplete: 'incomplete',
  canceled: 'canceled',
  incomplete_expired: 'canceled',
};

/** Status desconhecido vira `canceled`: na dúvida, sem acesso. */
export function mapSubscriptionStatus(status: string): SubscriptionStatus {
  return STATUS[status] ?? 'canceled';
}

/** Status da Stripe em que a assinatura ainda conta (não encerrada). */
const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);

function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function periodEnd(sub: StripeSubscriptionShape): number {
  return sub.current_period_end ?? sub.items.data[0]?.current_period_end ?? sub.created;
}

export function subscriptionCard(pm: StripeCardPaymentMethod | null): SubscriptionCard | null {
  if (!pm) return null;
  const card = mapCard(pm, null);
  return card ? { id: card.id, brand: card.brand, last4: card.last4 } : null;
}

export function toSubscription(
  sub: StripeSubscriptionShape,
  card: SubscriptionCard | null,
): Subscription {
  const price = sub.items.data[0]?.price;
  return {
    id: sub.id,
    planId: price?.id ?? '',
    priceCents: price?.unit_amount ?? 0,
    status: mapSubscriptionStatus(sub.status),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: isoFromUnix(periodEnd(sub)),
    card,
  };
}

function businessIdOf(sub: StripeSubscriptionShape): number | null {
  const value = Number(sub.metadata?.business_id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Assinatura que a tela mostra: a viva mais recente do negócio; sem viva, a
 * encerrada mais recente (a tela volta para a Oferta).
 */
export function pickCurrent(
  subs: StripeSubscriptionShape[],
  businessId: number,
): StripeSubscriptionShape | null {
  const own = subs
    .filter((s) => businessIdOf(s) === businessId)
    .sort((a, b) => b.created - a.created);
  return own.find((s) => LIVE.has(s.status)) ?? own[0] ?? null;
}

/** Assinar de novo só sem assinatura, encerrada ou com a 1ª cobrança falha. */
export function canSubscribe(status: SubscriptionStatus | null): boolean {
  return status === null || status === 'canceled' || status === 'incomplete';
}

/** Trocar cartão, cancelar e manter só com assinatura ativa ou em atraso. */
export function canManage(status: SubscriptionStatus | null): boolean {
  return status === 'active' || status === 'past_due';
}

/** Rascunho e anulada não são faturas para o lojista: null. */
export function toInvoice(inv: StripeInvoiceShape): SubscriptionInvoice | null {
  let status: SubscriptionInvoice['status'];
  if (inv.status === 'paid') status = 'paid';
  else if (inv.status === 'open' || inv.status === 'uncollectible') status = 'open';
  else return null;
  return { id: inv.id, amountCents: inv.total, status, createdAt: isoFromUnix(inv.created) };
}

export function invoiceSubscriptionId(inv: StripeInvoiceShape): string | null {
  return idOf(inv.parent?.subscription_details?.subscription) ?? idOf(inv.subscription);
}

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);
const INVOICE_EVENTS = new Set(['invoice.paid', 'invoice.payment_failed']);

/** Assinatura que o evento manda sincronizar; null = evento não é de assinatura. */
export function subscriptionEventTarget(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): { subscriptionId: string } | null {
  const object = event.data.object;
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    return typeof object.id === 'string' ? { subscriptionId: object.id } : null;
  }
  if (INVOICE_EVENTS.has(event.type)) {
    const subscriptionId = invoiceSubscriptionId(object as unknown as StripeInvoiceShape);
    return subscriptionId ? { subscriptionId } : null;
  }
  return null;
}

export interface SubscriptionRow {
  business_id: number;
  provider: 'stripe';
  provider_subscription_id: string;
  provider_customer_id: string | null;
  price_id: string | null;
  status: SubscriptionStatus;
  cancel_at_period_end: boolean;
  current_period_end: string;
}

/** Linha de `subscriptions`; null quando a assinatura não é de um negócio do app. */
export function subscriptionRow(sub: StripeSubscriptionShape): SubscriptionRow | null {
  const businessId = businessIdOf(sub);
  if (businessId === null) return null;
  return {
    business_id: businessId,
    provider: 'stripe',
    provider_subscription_id: sub.id,
    provider_customer_id: idOf(sub.customer),
    price_id: sub.items.data[0]?.price.id ?? null,
    status: mapSubscriptionStatus(sub.status),
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: isoFromUnix(periodEnd(sub)),
  };
}
