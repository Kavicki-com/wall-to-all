/**
 * Cliente da Stripe para as Edge Functions e o Customer de cada usuário.
 *
 * Versões fixadas no spike (design § 16): conta em `2026-10-28.endive`,
 * pacote `stripe` 23.1.0. A secret key vem só de `STRIPE_SECRET_KEY` (secret
 * do Supabase); nunca é logada.
 */

import Stripe from 'npm:stripe@23.1.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.85.0';
import { idempotencyKeys } from './idempotency.ts';

export const STRIPE_API_VERSION = '2026-10-28.endive';

let cached: Stripe | null = null;

export function stripeClient(): Stripe {
  if (cached) return cached;
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY ausente.');
  cached = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
  return cached;
}

export { Stripe };

/**
 * Customer da Stripe do usuário, criado na primeira vez. A chave de
 * idempotência `cus:{userId}` garante um único Customer mesmo com duas
 * chamadas simultâneas; o `on conflict` cobre a corrida no banco.
 */
export async function ensureCustomer(
  db: SupabaseClient,
  stripe: Stripe,
  user: { id: string; email: string | null },
): Promise<string> {
  const existing = await db
    .from('psp_customers')
    .select('customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.customer_id as string;

  const customer = await stripe.customers.create(
    {
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    },
    { idempotencyKey: idempotencyKeys.customer(user.id) },
  );

  const inserted = await db
    .from('psp_customers')
    .upsert(
      { user_id: user.id, provider: 'stripe', customer_id: customer.id },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
  if (inserted.error) throw inserted.error;

  const row = await db.from('psp_customers').select('customer_id').eq('user_id', user.id).single();
  if (row.error) throw row.error;
  return row.data.customer_id as string;
}
