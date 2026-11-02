/**
 * Edge Function `payments-create-intent`: cria (ou reaproveita) a cobrança e o
 * PaymentIntent de um agendamento ou de um fura-fila.
 *
 * Entrada: `{ purpose, method: 'card'|'pix', cardId?, amountCents, idempotencyKey }`.
 * Saída: `{ paymentId, status, clientSecret?, pix?, failureCode? }`.
 *
 * Uma linha em `payments` por `idempotency_key` (`booking:{id}` ou a chave da
 * tentativa de fura-fila) e um PI por linha. Nova tentativa reconfirma o MESMO
 * PI (outro cartão ou Pix), então não existe cobrança dupla. O status devolvido
 * é só dica: o app espera `payments.status`, que o webhook grava.
 */

import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { chooseFundsFlow } from '../_shared/fundsFlow.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { idempotencyKeys } from '../_shared/idempotency.ts';
import {
  buildConfirmParams,
  buildIntentParams,
  parseCreateIntentRequest,
  paymentIdempotencyKey,
  resolveAmountCents,
  summarizeIntent,
} from '../_shared/intentParams.ts';
import { isPixNextAction } from '../_shared/pixNextAction.ts';
import { platformFeeCents, priceToCents } from '../_shared/pricing.ts';
import { ensureCustomer, stripeClient, type Stripe } from '../_shared/stripe.ts';

function intEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} inválido.`);
  return value;
}

/** QR ainda utilizável por pelo menos 1 min: reabrir o sheet mostra o mesmo Pix. */
function pixStillValid(intent: Stripe.PaymentIntent): boolean {
  if (intent.status !== 'requires_action' || !isPixNextAction(intent.next_action)) return false;
  const expiresAt = intent.next_action?.pix_display_qr_code?.expires_at ?? 0;
  return expiresAt * 1000 > Date.now() + 60_000;
}

/** Recusa de cartão: a Stripe lança, mas o PI já existe e vem no erro. */
function intentFromCardError(err: unknown): Stripe.PaymentIntent | null {
  const e = err as {
    type?: string;
    payment_intent?: Stripe.PaymentIntent;
    raw?: { payment_intent?: Stripe.PaymentIntent };
  } | null;
  if (e?.type !== 'StripeCardError') return null;
  return e.payment_intent ?? e.raw?.payment_intent ?? null;
}

interface PaymentRow {
  id: string;
  payer_id: string | null;
  appointment_id: number | null;
  merchant_ref: string | null;
  status: string;
  amount_cents: number;
  provider_payment_id: string | null;
  confirm_attempts: number;
}

Deno.serve(
  handle('payments-create-intent', async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    const user = await requireUser(req);
    const request = parseCreateIntentRequest(await readJson(req));
    const db = adminClient();
    const stripe = stripeClient();

    // ── Valor (booking: do servidor) ─────────────────────────────────────────
    let serverAmountCents: number | null = null;
    let businessId: number | null = null;
    if (request.purpose.kind === 'booking') {
      const { data: appt, error } = await db
        .from('appointments')
        .select('id, client_id, business_id, status, services(price)')
        .eq('id', request.purpose.appointmentId)
        .maybeSingle();
      if (error) throw error;
      if (!appt || appt.client_id !== user.id) throw new HttpError(404, 'not_found');
      if (appt.status !== 'pending') {
        throw new HttpError(409, 'invalid_state', 'Agendamento não está pendente.');
      }
      const service = appt.services as unknown as { price: number } | null;
      if (!service) throw new Error(`Agendamento ${appt.id} sem serviço.`);
      serverAmountCents = priceToCents(Number(service.price));
      businessId = appt.business_id as number;
    }
    const amountCents = resolveAmountCents(request, {
      serverAmountCents,
      furaFilaMaxCents: intEnv('FURA_FILA_MAX_CENTS', 20000),
    });

    // ── Linha em payments (idempotente) ──────────────────────────────────────
    const key = paymentIdempotencyKey(request);
    const insert = await db.from('payments').upsert(
      {
        payer_id: user.id,
        purpose: request.purpose.kind,
        appointment_id: request.purpose.kind === 'booking' ? request.purpose.appointmentId : null,
        merchant_business_id: businessId,
        merchant_ref: request.purpose.kind === 'fura_fila' ? request.purpose.merchantRef : null,
        method: request.method,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents(amountCents, intEnv('PLATFORM_FEE_BPS', 0)),
        funds_flow: chooseFundsFlow({ purpose: request.purpose.kind, method: request.method }),
        provider: 'stripe',
        idempotency_key: key,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    );
    if (insert.error) {
      // Índice de uma cobrança viva por agendamento (ex.: já marcado "pagar na hora").
      if (insert.error.code === '23505') {
        throw new HttpError(409, 'invalid_state', 'Agendamento já tem cobrança.');
      }
      throw insert.error;
    }
    const { data: row, error: rowError } = await db
      .from('payments')
      .select(
        'id, payer_id, appointment_id, merchant_ref, status, amount_cents, provider_payment_id, confirm_attempts',
      )
      .eq('idempotency_key', key)
      .single<PaymentRow>();
    if (rowError) throw rowError;

    if (row.payer_id !== user.id) throw new HttpError(409, 'conflict', 'Chave de outro pagador.');
    if (request.purpose.kind === 'fura_fila' && row.merchant_ref !== request.purpose.merchantRef) {
      throw new HttpError(409, 'conflict', 'Chave de outra cobrança.');
    }
    if (row.amount_cents !== amountCents) {
      throw new HttpError(409, 'amount_mismatch', 'O valor mudou desde a primeira tentativa.');
    }
    if (row.status === 'succeeded') {
      return json({ paymentId: row.id, status: 'succeeded' });
    }
    if (['canceled', 'refunded', 'pay_on_site'].includes(row.status)) {
      throw new HttpError(409, 'invalid_state', `Cobrança ${row.status}.`);
    }

    // ── PaymentIntent ────────────────────────────────────────────────────────
    const customerId = await ensureCustomer(db, stripe, user);
    if (request.method === 'card') {
      const pm = await stripe.paymentMethods.retrieve(request.cardId as string);
      const owner = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
      if (owner !== customerId) throw new HttpError(404, 'card_not_found');
    }

    let intent: Stripe.PaymentIntent;
    try {
      if (!row.provider_payment_id) {
        intent = await stripe.paymentIntents.create(
          buildIntentParams({ paymentId: row.id, request, amountCents, customerId }),
          { idempotencyKey: idempotencyKeys.paymentIntent(row.id) },
        );
      } else {
        const current = await stripe.paymentIntents.retrieve(row.provider_payment_id);
        if (current.status === 'canceled') {
          throw new HttpError(409, 'invalid_state', 'Cobrança cancelada.');
        }
        if (
          current.status === 'succeeded' ||
          current.status === 'processing' ||
          (request.method === 'pix' && pixStillValid(current))
        ) {
          intent = current;
        } else {
          const attempt = row.confirm_attempts + 1;
          const bump = await db
            .from('payments')
            .update({ confirm_attempts: attempt, method: request.method })
            .eq('id', row.id);
          if (bump.error) throw bump.error;
          intent = await stripe.paymentIntents.confirm(current.id, buildConfirmParams(request), {
            idempotencyKey: idempotencyKeys.confirm(row.id, attempt),
          });
        }
      }
    } catch (err) {
      const declined = intentFromCardError(err);
      if (!declined) throw err;
      intent = declined;
    }

    if (!row.provider_payment_id) {
      const link = await db
        .from('payments')
        .update({ provider_payment_id: intent.id, confirm_attempts: 1 })
        .eq('id', row.id)
        .is('provider_payment_id', null);
      if (link.error) throw link.error;
    }

    return json({ paymentId: row.id, ...summarizeIntent(intent) });
  }),
);
