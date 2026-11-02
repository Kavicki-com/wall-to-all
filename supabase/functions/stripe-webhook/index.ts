/**
 * Edge Function `stripe-webhook` (deploy com `--no-verify-jwt`): a Stripe
 * chama sem JWT; a autenticidade vem da assinatura.
 *
 * 1. Corpo cru + `stripe-signature`, verificados com `STRIPE_WEBHOOK_SECRET`
 *    (endpoint da plataforma) e depois `STRIPE_CONNECT_WEBHOOK_SECRET`.
 * 2. Dedupe em `stripe_events`: evento já processado responde 200 sem refazer.
 * 3. Plano puro (`_shared/webhookPlan.ts`) executado: `apply_payment_event`
 *    (status + ledger numa transação), flags de `merchant_accounts`,
 *    notificação ao lojista.
 * 4. Sucesso grava `processed_at`; falha grava `error` e responde 500 para a
 *    Stripe reenviar.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.85.0';
import { adminClient } from '../_shared/admin.ts';
import { stripeClient, Stripe } from '../_shared/stripe.ts';
import {
  ledgerToRpc,
  paymentLookup,
  planForEvent,
  type MerchantNotification,
  type PaymentContext,
  type StripeEventShape,
  type WebhookPlan,
} from '../_shared/webhookPlan.ts';

const SECRETS: Array<[string, 'platform' | 'connect']> = [
  ['STRIPE_WEBHOOK_SECRET', 'platform'],
  ['STRIPE_CONNECT_WEBHOOK_SECRET', 'connect'],
];

const cryptoProvider = Stripe.createSubtleCryptoProvider();

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

function optionalIntEnv(name: string): number | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function verify(
  stripe: Stripe,
  body: string,
  signature: string,
): Promise<{ event: Stripe.Event; endpoint: 'platform' | 'connect' } | null> {
  for (const [name, endpoint] of SECRETS) {
    const secret = Deno.env.get(name);
    if (!secret) continue;
    try {
      const event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        secret,
        undefined,
        cryptoProvider,
      );
      return { event, endpoint };
    } catch {
      // tenta o próximo segredo
    }
  }
  return null;
}

interface PaymentJoinRow {
  id: string;
  purpose: PaymentContext['purpose'];
  funds_flow: PaymentContext['fundsFlow'];
  amount_cents: number;
  platform_fee_cents: number;
  merchant_business_id: number | null;
  status: PaymentContext['status'];
  method: PaymentContext['method'];
  appointment_id: number | null;
  payer_id: string | null;
  appointments: { start_time: string; services: { name: string } | null } | null;
  business_profiles: { owner_id: string } | null;
}

async function loadPayment(
  db: SupabaseClient,
  lookup: { paymentId: string } | { providerPaymentId: string },
): Promise<PaymentContext | null> {
  let query = db
    .from('payments')
    .select(
      'id, purpose, funds_flow, amount_cents, platform_fee_cents, merchant_business_id, status, method, appointment_id, payer_id, appointments(start_time, services(name)), business_profiles(owner_id)',
    );
  query =
    'paymentId' in lookup
      ? query.eq('id', lookup.paymentId)
      : query.eq('provider_payment_id', lookup.providerPaymentId);
  const { data, error } = await query.maybeSingle<PaymentJoinRow>();
  if (error) throw error;
  if (!data) return null;

  let payerName = 'Cliente';
  if (data.payer_id) {
    const profile = await db
      .from('profiles')
      .select('full_name')
      .eq('id', data.payer_id)
      .maybeSingle();
    if (profile.error) throw profile.error;
    payerName = (profile.data?.full_name as string | null) || 'Cliente';
  }

  return {
    id: data.id,
    purpose: data.purpose,
    fundsFlow: data.funds_flow,
    amountCents: data.amount_cents,
    platformFeeCents: data.platform_fee_cents,
    merchantBusinessId: data.merchant_business_id,
    serviceName: data.appointments?.services?.name ?? null,
    payerName,
    status: data.status,
    method: data.method,
    appointmentId: data.appointment_id,
    merchantOwnerId: data.business_profiles?.owner_id ?? null,
    appointmentStartTime: data.appointments?.start_time ?? null,
  };
}

async function cardOfIntent(
  stripe: Stripe,
  intent: Stripe.PaymentIntent,
): Promise<{ last4: string | null; brand: string | null } | null> {
  const chargeId =
    typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
  if (!chargeId) return null;
  const charge = await stripe.charges.retrieve(chargeId);
  const card = charge.payment_method_details?.card;
  return card ? { last4: card.last4 ?? null, brand: card.brand ?? null } : null;
}

async function notify(db: SupabaseClient, n: MerchantNotification): Promise<void> {
  const { data, error } = await db.rpc('insert_notification', {
    p_user_id: n.userId,
    p_type: n.type,
    p_title: n.title,
    p_message: n.message,
    p_related_appointment_id: n.appointmentId,
  });
  if (error || (data && data.success === false)) {
    // Notificação não pode derrubar o pagamento: registra e segue.
    console.warn('[stripe-webhook] notificação falhou:', error?.message ?? data?.error);
    return;
  }
  // Push, como o app faz em `sendNotification` (best effort).
  db.functions
    .invoke('send-push-notification', {
      body: {
        user_id: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        related_appointment_id: n.appointmentId,
        related_reschedule_id: null,
      },
    })
    .catch((err) => console.warn('[stripe-webhook] push falhou:', err));
}

async function execute(db: SupabaseClient, plan: WebhookPlan): Promise<string> {
  if (plan.kind === 'ignore') return `ignored:${plan.reason}`;

  if (plan.kind === 'account') {
    const update = plan.disconnected
      ? {
          charges_enabled: false,
          payouts_enabled: false,
          disconnected_at: new Date().toISOString(),
        }
      : {
          charges_enabled: plan.flags?.chargesEnabled ?? false,
          payouts_enabled: plan.flags?.payoutsEnabled ?? false,
          details_submitted: plan.flags?.detailsSubmitted ?? false,
          requirements_due: plan.flags?.requirementsDue ?? [],
        };
    const { error } = await db
      .from('merchant_accounts')
      .update(update)
      .eq('account_id', plan.accountId);
    if (error) throw error;
    return 'account_updated';
  }

  const { data, error } = await db.rpc('apply_payment_event', {
    p_payment_id: plan.paymentId,
    p_status: plan.status,
    p_fields: plan.fields,
    p_ledger: ledgerToRpc(plan.ledger),
    p_cancel_appointment: plan.cancelAppointment,
  });
  if (error) throw error;
  const applied = (data as { applied?: boolean } | null)?.applied === true;
  if (applied && plan.notifyMerchant) await notify(db, plan.notifyMerchant);
  return applied ? `applied:${plan.status}` : `noop:${plan.status}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('method not allowed', 405);
  const signature = req.headers.get('stripe-signature');
  if (!signature) return text('missing signature', 400);

  const body = await req.text();
  const stripe = stripeClient();
  const verified = await verify(stripe, body, signature);
  if (!verified) {
    console.warn('[stripe-webhook] assinatura inválida');
    return text('invalid signature', 400);
  }
  const { event, endpoint } = verified;
  const db = adminClient();

  const recorded = await db
    .from('stripe_events')
    .upsert(
      { id: event.id, type: event.type, endpoint, livemode: event.livemode },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  if (recorded.error) {
    console.error('[stripe-webhook] stripe_events:', recorded.error.message);
    return text('storage error', 500);
  }
  const existing = await db
    .from('stripe_events')
    .select('processed_at')
    .eq('id', event.id)
    .single();
  if (existing.error) return text('storage error', 500);
  if (existing.data.processed_at) return text('duplicate', 200);

  try {
    let result: string;
    if (event.livemode) {
      // Projeto do piloto é só test mode: evento real nunca mexe no banco.
      result = 'ignored:livemode';
    } else {
      const shape = event as unknown as StripeEventShape;
      const lookup = paymentLookup(shape);
      const payment = lookup ? await loadPayment(db, lookup) : null;
      const charge =
        event.type === 'payment_intent.succeeded' && payment?.method === 'card'
          ? await cardOfIntent(stripe, event.data.object as Stripe.PaymentIntent)
          : null;
      const plan = planForEvent(shape, {
        payment,
        charge,
        demoBusinessId: optionalIntEnv('DEMO_FURA_FILA_BUSINESS_ID'),
      });
      result = await execute(db, plan);
    }
    await db
      .from('stripe_events')
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq('id', event.id);
    console.log(`[stripe-webhook] ${event.id} ${event.type} ${result}`);
    return text(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] ${event.id} ${event.type} falhou:`, message);
    await db
      .from('stripe_events')
      .update({ error: message.slice(0, 500) })
      .eq('id', event.id);
    return text('processing error', 500);
  }
});
