/**
 * Edge Function `subscriptions`: assinatura do lojista no Stripe Billing
 * (só cartão; a Stripe não faz Pix recorrente). Contrato com
 * `lib/services/stripe/stripeSubscriptionService.ts`.
 *
 * - `GET` -> `{ priceCents, subscription }` (assinatura atual do negócio ou null).
 * - `POST { action: 'subscribe', paymentMethodId }` -> `{ subscription, clientSecret }`.
 * - `POST { action: 'update_card', paymentMethodId }` -> `{ subscription, clientSecret }`.
 * - `POST { action: 'cancel' }` / `{ action: 'resume' }` -> `{ subscription }`.
 * - `POST { action: 'invoices' }` -> `SubscriptionInvoice[]`, mais recente primeiro.
 *
 * Decisão de execução (design § 16): `payment_behavior: 'allow_incomplete'`
 * em vez de `default_incomplete`. O servidor cobra a 1ª fatura na hora com o
 * cartão salvo, como o contrato da F7 pede: aprovado vira `active`, recusa
 * vira `incomplete` sem lançar. `clientSecret` só vem quando o banco pede
 * autenticação (3DS); o app conclui com `handleNextAction`.
 *
 * A Stripe é a fonte da verdade: toda resposta lê a assinatura na API e grava
 * a cópia em `subscriptions` (o webhook mantém a cópia nas renovações).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.85.0';
import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import type { StripeCardPaymentMethod } from '../_shared/cardMapper.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { ensureCustomer, stripeClient, type Stripe } from '../_shared/stripe.ts';
import {
  canManage,
  canSubscribe,
  invoiceSubscriptionId,
  mapSubscriptionStatus,
  pickCurrent,
  subscriptionCard,
  toInvoice,
  toSubscription,
  type StripeInvoiceShape,
  type StripeSubscriptionShape,
  type Subscription,
  type SubscriptionInvoice,
} from '../_shared/subscriptionStatus.ts';
import { saveSubscription } from '../_shared/subscriptionSync.ts';

const EXPAND_CARD = ['default_payment_method'];

function priceId(): string {
  const value = Deno.env.get('STRIPE_SUBSCRIPTION_PRICE_ID');
  if (!value) throw new Error('STRIPE_SUBSCRIPTION_PRICE_ID ausente.');
  return value;
}

function shape(sub: Stripe.Subscription): StripeSubscriptionShape {
  return sub as unknown as StripeSubscriptionShape;
}

/** Negócio do lojista; quem não tem negócio não assina. */
async function ownedBusinessId(db: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await db
    .from('business_profiles')
    .select('id')
    .eq('owner_id', userId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, 'forbidden', 'Só lojistas assinam.');
  return data.id as number;
}

/** Assinaturas do negócio no Customer do lojista, com o cartão expandido. */
async function ownSubscriptions(
  stripe: Stripe,
  customerId: string,
  businessId: number,
): Promise<Stripe.Subscription[]> {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
    expand: ['data.default_payment_method'],
  });
  return list.data.filter((s) => s.metadata?.business_id === String(businessId));
}

function toDto(sub: Stripe.Subscription): Subscription {
  const pm = sub.default_payment_method;
  const card =
    pm && typeof pm !== 'string'
      ? subscriptionCard(pm as unknown as StripeCardPaymentMethod)
      : null;
  return toSubscription(shape(sub), card);
}

/** Cartão salvo do próprio lojista; outro Customer responde como inexistente. */
async function ownCard(stripe: Stripe, customerId: string, value: unknown): Promise<string> {
  if (typeof value !== 'string' || !value.startsWith('pm_')) {
    throw new HttpError(400, 'bad_request', 'paymentMethodId inválido.');
  }
  const pm = await stripe.paymentMethods.retrieve(value);
  const owner = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
  if (owner !== customerId || pm.type !== 'card') throw new HttpError(404, 'card_not_found');
  return pm.id;
}

/** client_secret do PaymentIntent da fatura quando o banco pede 3DS; senão null. */
async function pendingAuthentication(stripe: Stripe, invoiceId: string): Promise<string | null> {
  const payments = await stripe.invoicePayments.list({
    invoice: invoiceId,
    expand: ['data.payment.payment_intent'],
  });
  for (const item of payments.data) {
    const intent = item.payment?.payment_intent;
    if (intent && typeof intent !== 'string' && intent.status === 'requires_action') {
      return intent.client_secret;
    }
  }
  return null;
}

function latestInvoiceId(sub: Stripe.Subscription): string | null {
  const inv = sub.latest_invoice;
  if (!inv) return null;
  return typeof inv === 'string' ? inv : inv.id ?? null;
}

async function respond(
  db: SupabaseClient,
  sub: Stripe.Subscription,
  clientSecret: string | null = null,
): Promise<Response> {
  await saveSubscription(db, sub);
  return json({ subscription: toDto(sub), clientSecret });
}

Deno.serve(
  handle('subscriptions', async (req) => {
    const user = await requireUser(req);
    const db = adminClient();
    const stripe = stripeClient();
    const businessId = await ownedBusinessId(db, user.id);
    const customerId = await ensureCustomer(db, stripe, user);
    const subs = await ownSubscriptions(stripe, customerId, businessId);
    const current = pickCurrent(subs.map(shape), businessId) as unknown as Stripe.Subscription | null;
    const currentStatus = current ? mapSubscriptionStatus(current.status) : null;

    if (req.method === 'GET') {
      if (current) await saveSubscription(db, current);
      const price = await stripe.prices.retrieve(priceId());
      return json({
        priceCents: price.unit_amount ?? 0,
        subscription: current ? toDto(current) : null,
      });
    }

    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    const body = await readJson(req);

    if (body.action === 'subscribe') {
      const paymentMethodId = await ownCard(stripe, customerId, body.paymentMethodId);
      if (!canSubscribe(currentStatus)) {
        throw new HttpError(409, 'invalid_state', 'Negócio já tem assinatura ativa.');
      }
      if (current && current.status === 'incomplete') {
        // 1ª cobrança falhou: troca pela nova tentativa, sem duas assinaturas vivas.
        await saveSubscription(db, await stripe.subscriptions.cancel(current.id));
      }
      const created = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId() }],
        default_payment_method: paymentMethodId,
        payment_behavior: 'allow_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        metadata: { business_id: String(businessId), user_id: user.id },
        expand: EXPAND_CARD,
      });
      const invoiceId = latestInvoiceId(created);
      const clientSecret =
        created.status === 'incomplete' && invoiceId
          ? await pendingAuthentication(stripe, invoiceId)
          : null;
      return respond(db, created, clientSecret);
    }

    if (body.action === 'update_card') {
      const paymentMethodId = await ownCard(stripe, customerId, body.paymentMethodId);
      if (!current || !canManage(currentStatus)) {
        throw new HttpError(409, 'invalid_state', 'Sem assinatura ativa.');
      }
      const updated = await stripe.subscriptions.update(current.id, {
        default_payment_method: paymentMethodId,
      });
      let clientSecret: string | null = null;
      const invoiceId = latestInvoiceId(updated);
      if (currentStatus === 'past_due' && invoiceId) {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (invoice.status === 'open') {
          try {
            await stripe.invoices.pay(invoiceId, { payment_method: paymentMethodId });
          } catch (err) {
            const stripeErr = err as { type?: string } | null;
            // Recusa ou 3DS: continua em atraso, sem lançar (contrato da F7).
            if (stripeErr?.type !== 'StripeCardError') throw err;
            clientSecret = await pendingAuthentication(stripe, invoiceId);
          }
        }
      }
      const fresh = await stripe.subscriptions.retrieve(current.id, { expand: EXPAND_CARD });
      return respond(db, fresh, clientSecret);
    }

    if (body.action === 'cancel' || body.action === 'resume') {
      if (!current || !canManage(currentStatus)) {
        throw new HttpError(409, 'invalid_state', 'Sem assinatura ativa.');
      }
      const updated = await stripe.subscriptions.update(current.id, {
        cancel_at_period_end: body.action === 'cancel',
        expand: EXPAND_CARD,
      });
      return respond(db, updated);
    }

    if (body.action === 'invoices') {
      const ids = new Set(subs.map((s) => s.id));
      const list = await stripe.invoices.list({ customer: customerId, limit: 24 });
      const invoices = list.data
        .filter((inv) => {
          const subId = invoiceSubscriptionId(inv as unknown as StripeInvoiceShape);
          return subId !== null && ids.has(subId);
        })
        .map((inv) => toInvoice(inv as unknown as StripeInvoiceShape))
        .filter((inv): inv is SubscriptionInvoice => inv !== null);
      return json(invoices);
    }

    throw new HttpError(400, 'bad_request', 'action desconhecida.');
  }),
);
