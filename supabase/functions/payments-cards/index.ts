/**
 * Edge Function `payments-cards`: cartões salvos do usuário (Customer da Stripe).
 *
 * - `GET` -> `PaymentCard[]` (garante o Customer na primeira chamada).
 * - `POST { action: 'setup' }` -> `{ setupIntentClientSecret }` para o
 *   `confirmSetupIntent` do SDK (o número do cartão nunca passa por aqui).
 * - `POST { action: 'complete', setupIntentId }` -> `PaymentCard` do cartão
 *   anexado; vira default se o Customer ainda não tem um.
 *
 * Spike (design § 16): sem `payment_method_types`; cartão via
 * `automatic_payment_methods` com `allow_redirects: 'never'`.
 */

import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { mapCard, mapCards, type StripeCardPaymentMethod } from '../_shared/cardMapper.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { ensureCustomer, stripeClient, type Stripe } from '../_shared/stripe.ts';

function defaultPaymentMethodId(customer: Stripe.Customer | Stripe.DeletedCustomer): string | null {
  if ('deleted' in customer && customer.deleted) return null;
  const value = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

Deno.serve(
  handle('payments-cards', async (req) => {
    const user = await requireUser(req);
    const db = adminClient();
    const stripe = stripeClient();
    const customerId = await ensureCustomer(db, stripe, user);

    if (req.method === 'GET') {
      const [customer, list] = await Promise.all([
        stripe.customers.retrieve(customerId),
        stripe.customers.listPaymentMethods(customerId, { type: 'card', limit: 100 }),
      ]);
      const cards = mapCards(
        list.data as unknown as StripeCardPaymentMethod[],
        defaultPaymentMethodId(customer),
      );
      return json(cards);
    }

    if (req.method !== 'POST') {
      throw new HttpError(405, 'method_not_allowed');
    }

    const body = await readJson(req);

    if (body.action === 'setup') {
      const intent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'on_session',
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { user_id: user.id },
      });
      if (!intent.client_secret) {
        throw new HttpError(502, 'provider_error', 'SetupIntent sem client_secret.');
      }
      return json({ setupIntentClientSecret: intent.client_secret });
    }

    if (body.action === 'complete') {
      const setupIntentId = body.setupIntentId;
      if (typeof setupIntentId !== 'string' || !setupIntentId.startsWith('seti_')) {
        throw new HttpError(400, 'bad_request', 'setupIntentId inválido.');
      }
      const intent = await stripe.setupIntents.retrieve(setupIntentId, {
        expand: ['payment_method'],
      });
      const intentCustomer =
        typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
      // SetupIntent de outro usuário: responde como inexistente.
      if (intentCustomer !== customerId) throw new HttpError(404, 'not_found');
      if (intent.status !== 'succeeded') throw new HttpError(409, 'setup_not_succeeded');

      const pm = intent.payment_method;
      if (!pm || typeof pm === 'string') {
        throw new HttpError(502, 'provider_error', 'SetupIntent sem payment_method.');
      }
      const card = mapCard(pm as unknown as StripeCardPaymentMethod, null);
      if (!card) {
        // Bandeira que o app não exibe: não deixa o cartão anexado e invisível.
        await stripe.paymentMethods.detach(pm.id);
        throw new HttpError(422, 'unsupported_card_brand');
      }

      const customer = await stripe.customers.retrieve(customerId);
      let defaultId = defaultPaymentMethodId(customer);
      if (!defaultId) {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: pm.id },
        });
        defaultId = pm.id;
      }
      return json({ ...card, isDefault: card.id === defaultId });
    }

    throw new HttpError(400, 'bad_request', 'action desconhecida.');
  }),
);
