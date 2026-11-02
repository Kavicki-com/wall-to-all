/**
 * Cliente Supabase com service role (ignora RLS). Só para Edge Functions:
 * toda escrita em payments/ledger/withdrawals/merchant_accounts/psp_customers
 * passa por aqui. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados
 * pela plataforma.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.85.0';

let cached: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes.');
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
