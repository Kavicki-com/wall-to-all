/**
 * Cópia local da assinatura (tabela `subscriptions`), usada pela Edge
 * Function `subscriptions` e pelo `stripe-webhook`. A Stripe é a fonte da
 * verdade; aqui só se grava o retrato mais recente.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.85.0';
import type { Stripe } from './stripe.ts';
import { subscriptionRow, type StripeSubscriptionShape } from './subscriptionStatus.ts';

/** Grava a assinatura; devolve o status gravado ou null se não é do app. */
export async function saveSubscription(
  db: SupabaseClient,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const row = subscriptionRow(sub as unknown as StripeSubscriptionShape);
  if (!row) return null;
  const { error } = await db
    .from('subscriptions')
    .upsert(row, { onConflict: 'provider_subscription_id' });
  if (error) throw error;
  return row.status;
}

/** Relê a assinatura na Stripe e grava (o evento pode estar desatualizado). */
export async function syncSubscription(
  db: SupabaseClient,
  stripe: Stripe,
  subscriptionId: string,
): Promise<string> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const status = await saveSubscription(db, sub);
  return status ? `subscription_synced:${status}` : 'ignored:not_app_subscription';
}
