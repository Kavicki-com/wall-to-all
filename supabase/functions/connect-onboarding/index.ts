/**
 * Edge Function `connect-onboarding` (design § 9): conta de recebimento do
 * lojista dono do negócio.
 *
 * - `GET` -> `{ status, chargesEnabled, payoutsEnabled, requirementsDue }`.
 * - `POST { action: 'link' }` -> cria a conta conectada se não houver
 *   (Accounts v2, chave `acct:{businessId}`), grava `merchant_accounts` e
 *   devolve `{ url }` do Account Link de onboarding.
 * - `POST { action: 'sync' }` -> relê a conta na Stripe, atualiza as flags e
 *   devolve o mesmo corpo do `GET`. O webhook `account.updated` faz o mesmo
 *   em segundo plano; o `sync` cobre o retorno do formulário antes do evento.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.85.0';
import { accountFlags, payoutAccountStatus } from '../_shared/accountFlags.ts';
import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { accountLinkUrls, v2AccountBody } from '../_shared/connectAccount.ts';
import { handle, HttpError, json, readJson } from '../_shared/http.ts';
import { idempotencyKeys } from '../_shared/idempotency.ts';
import { stripeClient } from '../_shared/stripe.ts';

/** Versão preview exigida pela Accounts v2 (spike g). */
const V2_API_VERSION = '2026-10-28.preview';

interface MerchantAccountRow {
  account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements_due: string[];
  disconnected_at: string | null;
}

async function ownedBusiness(
  db: SupabaseClient,
  userId: string,
): Promise<{ id: number; name: string | null }> {
  const { data, error } = await db
    .from('business_profiles')
    .select('id, business_name')
    .eq('owner_id', userId)
    .order('id')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, 'forbidden', 'Usuário não é dono de um negócio.');
  return { id: data.id as number, name: (data.business_name as string | null) ?? null };
}

async function loadAccount(
  db: SupabaseClient,
  businessId: number,
): Promise<MerchantAccountRow | null> {
  const { data, error } = await db
    .from('merchant_accounts')
    .select('account_id, charges_enabled, payouts_enabled, requirements_due, disconnected_at')
    .eq('business_id', businessId)
    .maybeSingle<MerchantAccountRow>();
  if (error) throw error;
  return data;
}

function statusBody(row: MerchantAccountRow | null) {
  return {
    status: payoutAccountStatus(
      row ? { payoutsEnabled: row.payouts_enabled, disconnected: !!row.disconnected_at } : null,
    ),
    chargesEnabled: row?.charges_enabled ?? false,
    payoutsEnabled: row?.payouts_enabled ?? false,
    requirementsDue: row?.requirements_due ?? [],
  };
}

/** `POST /v2/core/accounts`: o SDK fixa a versão da v1, então vai por fetch. */
async function createV2Account(body: unknown, idempotencyKey: string): Promise<string> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY ausente.');
  const res = await fetch('https://api.stripe.com/v2/core/accounts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Stripe-Version': V2_API_VERSION,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => null)) as {
    id?: string;
    error?: { type?: string; code?: string; message?: string };
  } | null;
  if (!res.ok || !payload?.id) {
    console.error(
      '[connect-onboarding] v2 accounts:',
      res.status,
      payload?.error?.type,
      payload?.error?.code,
      payload?.error?.message,
    );
    throw new HttpError(502, 'provider_error', payload?.error?.code ?? 'account_create_failed');
  }
  return payload.id;
}

async function syncAccount(
  db: SupabaseClient,
  businessId: number,
  accountId: string,
): Promise<MerchantAccountRow | null> {
  const account = await stripeClient().accounts.retrieve(accountId);
  const flags = accountFlags(account);
  const { error } = await db
    .from('merchant_accounts')
    .update({
      charges_enabled: flags.chargesEnabled,
      payouts_enabled: flags.payoutsEnabled,
      details_submitted: flags.detailsSubmitted,
      requirements_due: flags.requirementsDue,
    })
    .eq('business_id', businessId);
  if (error) throw error;
  return loadAccount(db, businessId);
}

Deno.serve(
  handle('connect-onboarding', async (req) => {
    const user = await requireUser(req);
    const db = adminClient();
    const business = await ownedBusiness(db, user.id);

    if (req.method === 'GET') {
      return json(statusBody(await loadAccount(db, business.id)));
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');

    const { action } = await readJson(req);
    let row = await loadAccount(db, business.id);

    if (action === 'sync') {
      if (!row || row.disconnected_at) return json(statusBody(row));
      return json(statusBody(await syncAccount(db, business.id, row.account_id)));
    }

    if (action !== 'link') throw new HttpError(400, 'bad_request', 'action inválida.');

    if (row?.disconnected_at) {
      // Reconectar exige conta nova e chave nova: fora do piloto.
      throw new HttpError(409, 'invalid_state', 'Conta de recebimento desconectada.');
    }

    if (!row) {
      let body;
      try {
        body = v2AccountBody({
          businessId: business.id,
          email: user.email,
          displayName: business.name,
        });
      } catch {
        throw new HttpError(422, 'bad_request', 'Usuário sem e-mail para a conta de recebimento.');
      }
      const accountId = await createV2Account(body, idempotencyKeys.account(business.id));
      // Duas chamadas simultâneas recebem a mesma conta (mesma chave): a
      // segunda inserção vira no-op.
      const inserted = await db
        .from('merchant_accounts')
        .upsert(
          { business_id: business.id, provider: 'stripe', account_id: accountId },
          { onConflict: 'business_id', ignoreDuplicates: true },
        );
      if (inserted.error) throw inserted.error;
      row = await loadAccount(db, business.id);
      if (!row) throw new Error('merchant_accounts não gravou a conta.');
    }

    const baseUrl = Deno.env.get('CONNECT_RETURN_BASE_URL');
    if (!baseUrl) throw new Error('CONNECT_RETURN_BASE_URL ausente.');
    const link = await stripeClient().accountLinks.create({
      account: row.account_id,
      type: 'account_onboarding',
      ...accountLinkUrls(baseUrl),
    });
    return json({ url: link.url });
  }),
);
