/**
 * Edge Function `payments-cancel`: o cliente desistiu de pagar a reserva
 * (voltou depois da recusa, fechou o sheet do Pix). Cancela o PaymentIntent
 * não pago e libera o horário (`appointments.status = 'canceled'`).
 *
 * Entrada: `{ appointmentId }`. Saída: `{ appointmentId, status: 'canceled' }`.
 * Idempotente: repetir não muda nada. Cobrança já paga (ou Pix em liquidação)
 * não é cancelada aqui: estorno fica fora do piloto (design § 13, decisão E).
 */

import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { idempotencyKeys } from '../_shared/idempotency.ts';
import { stripeClient } from '../_shared/stripe.ts';

const CANCELABLE_INTENT = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
]);

Deno.serve(
  handle('payments-cancel', async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    const user = await requireUser(req);
    const { appointmentId } = await readJson(req);
    if (typeof appointmentId !== 'number' || !Number.isInteger(appointmentId)) {
      throw new HttpError(400, 'bad_request', 'appointmentId inválido.');
    }
    const db = adminClient();

    const { data: appt, error: apptError } = await db
      .from('appointments')
      .select('id, client_id, status')
      .eq('id', appointmentId)
      .maybeSingle();
    if (apptError) throw apptError;
    if (!appt || appt.client_id !== user.id) throw new HttpError(404, 'not_found');

    const { data: payment, error: payError } = await db
      .from('payments')
      .select('id, status, provider_payment_id')
      .eq('idempotency_key', `booking:${appointmentId}`)
      .maybeSingle();
    if (payError) throw payError;

    if (payment) {
      if (payment.status === 'succeeded' || payment.status === 'processing') {
        throw new HttpError(409, 'invalid_state', 'Cobrança já paga ou em liquidação.');
      }
      if (payment.provider_payment_id && payment.status !== 'canceled') {
        const stripe = stripeClient();
        const intent = await stripe.paymentIntents.retrieve(payment.provider_payment_id);
        if (intent.status === 'succeeded' || intent.status === 'processing') {
          // Pagou agora há pouco e o webhook ainda não chegou.
          throw new HttpError(409, 'invalid_state', 'Cobrança já paga ou em liquidação.');
        }
        if (CANCELABLE_INTENT.has(intent.status)) {
          await stripe.paymentIntents.cancel(
            intent.id,
            { cancellation_reason: 'abandoned' },
            { idempotencyKey: idempotencyKeys.cancel(payment.id) },
          );
        }
      }
      // Mesmo caminho do webhook: status só avança e o agendamento pendente cai.
      const applied = await db.rpc('apply_payment_event', {
        p_payment_id: payment.id,
        p_status: 'canceled',
        p_fields: {},
        p_ledger: [],
        p_cancel_appointment: true,
      });
      if (applied.error) throw applied.error;
    }

    // Sem cobrança (ou já cancelada): só libera o horário se ainda pendente.
    const release = await db
      .from('appointments')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('status', 'pending');
    if (release.error) throw release.error;

    return json({ appointmentId, status: 'canceled' });
  }),
);
