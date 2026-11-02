/**
 * Edge Function `wallet-withdraw` (design § 16): saque do Financeiro, do QI do
 * lojista e do QI do cliente.
 *
 * Entrada: `{ source, amountCents, pixKeyId, idempotencyKey }`.
 * Saída: `{ withdrawalId, status, amountCents, feeCents, netCents }`.
 *
 * 1. Cotação e regras no servidor (`withdrawPlan.ts`); a cotação do app nunca
 *    é usada.
 * 2. `begin_withdrawal` (uma transação, sob lock): confere o saldo, grava o
 *    saque e o ledger e aloca o líquido sobre as cobranças mais antigas.
 * 3. Um transfer por alocação, com `source_transaction` = charge da cobrança
 *    (exigência da Stripe no BR) e chave `transfer:{saque}:{alocação}`.
 * 4. Todos feitos -> `paid`. Falha antes do primeiro transfer ->
 *    `fail_withdrawal` (estorna o ledger). Falha no meio -> fica `processing`
 *    e o retry com a mesma `idempotencyKey` retoma os que faltam.
 *
 * QI do cliente: `manual_pending`, sem Stripe (a operação paga por fora).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.85.0';
import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { handle, HttpError, json, readJson, type ErrorCode } from '../_shared/http.ts';
import { idempotencyKeys } from '../_shared/idempotency.ts';
import { stripeClient } from '../_shared/stripe.ts';
import { ledgerToRpc } from '../_shared/webhookPlan.ts';
import {
  dbWithdrawError,
  parseWithdrawRequest,
  planWithdraw,
  withdrawalIdempotencyKey,
  type WithdrawRequest,
} from '../_shared/withdrawPlan.ts';

const PLAN_ERROR_STATUS: Record<string, number> = {
  bad_request: 400,
  below_minimum: 422,
  insufficient_balance: 422,
  payout_account_inactive: 409,
};

interface TransferRow {
  id: number;
  payment_id: string;
  provider_payment_id: string;
  amount_cents: number;
  status: 'pending' | 'succeeded' | 'failed';
  provider_transfer_id: string | null;
}

interface BeginResult {
  withdrawal_id: string;
  existing: boolean;
  status: 'processing' | 'paid' | 'failed' | 'manual_pending' | 'requested';
  transfers: TransferRow[];
}

interface MerchantContext {
  businessId: number;
  accountId: string | null;
  account: { payoutsEnabled: boolean; disconnected: boolean } | null;
}

async function merchantContext(db: SupabaseClient, userId: string): Promise<MerchantContext> {
  const biz = await db.from('business_profiles').select('id').eq('owner_id', userId).maybeSingle();
  if (biz.error) throw biz.error;
  if (!biz.data) throw new HttpError(403, 'forbidden', 'Usuário não é dono de um negócio.');
  const businessId = biz.data.id as number;

  const acct = await db
    .from('merchant_accounts')
    .select('account_id, payouts_enabled, disconnected_at')
    .eq('business_id', businessId)
    .maybeSingle();
  if (acct.error) throw acct.error;
  return {
    businessId,
    accountId: (acct.data?.account_id as string | undefined) ?? null,
    account: acct.data
      ? {
          payoutsEnabled: acct.data.payouts_enabled === true,
          disconnected: !!acct.data.disconnected_at,
        }
      : null,
  };
}

async function balanceCents(
  db: SupabaseClient,
  request: WithdrawRequest,
  userId: string,
  businessId: number | null,
): Promise<number> {
  if (request.source === 'qi_client') {
    const { data, error } = await db
      .from('ledger_entries')
      .select('amount_cents')
      .eq('user_id', userId)
      .eq('account', 'client_qi');
    if (error) throw error;
    return (data ?? []).reduce((sum, row) => sum + (row.amount_cents as number), 0);
  }
  const { data, error } = await db.rpc('merchant_balance_cents', {
    p_business_id: businessId,
    p_account: request.source === 'financeiro' ? 'merchant' : 'merchant_qi',
  });
  if (error) throw error;
  return Number(data ?? 0);
}

async function begin(
  db: SupabaseClient,
  withdrawal: Record<string, unknown>,
  ledger: ReturnType<typeof ledgerToRpc>,
): Promise<BeginResult> {
  const { data, error } = await db.rpc('begin_withdrawal', {
    p_withdrawal: withdrawal,
    p_ledger: ledger,
  });
  if (error) {
    const code = dbWithdrawError(error.message);
    if (code) throw new HttpError(code === 'insufficient_balance' ? 422 : 409, code, error.message);
    throw error;
  }
  return data as BeginResult;
}

/** Executa os transfers pendentes. Devolve o código da falha, ou null. */
async function runTransfers(
  db: SupabaseClient,
  withdrawalId: string,
  accountId: string,
  transfers: TransferRow[],
): Promise<{ failure: string | null; firstTransferId: string | null }> {
  const stripe = stripeClient();
  let firstTransferId = transfers.find((t) => t.provider_transfer_id)?.provider_transfer_id ?? null;
  for (const t of transfers) {
    if (t.status !== 'pending') continue;
    try {
      const intent = await stripe.paymentIntents.retrieve(t.provider_payment_id);
      const chargeId =
        typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
      if (!chargeId) throw new Error(`Cobrança sem charge: ${t.provider_payment_id}`);
      const transfer = await stripe.transfers.create(
        {
          amount: t.amount_cents,
          currency: 'brl',
          destination: accountId,
          source_transaction: chargeId,
          transfer_group: `withdrawal_${withdrawalId}`,
          metadata: { withdrawal_id: withdrawalId, payment_id: t.payment_id },
        },
        { idempotencyKey: idempotencyKeys.transfer(withdrawalId, t.id) },
      );
      const saved = await db
        .from('payment_transfers')
        .update({ status: 'succeeded', provider_transfer_id: transfer.id })
        .eq('id', t.id);
      if (saved.error) throw saved.error;
      firstTransferId ??= transfer.id;
    } catch (err) {
      const e = err as { type?: string; code?: string; message?: string };
      console.error(
        '[wallet-withdraw] transfer falhou:',
        withdrawalId,
        t.id,
        e.type,
        e.code,
        e.message,
      );
      return { failure: e.code ?? e.type ?? 'transfer_failed', firstTransferId };
    }
  }
  return { failure: null, firstTransferId };
}

Deno.serve(
  handle('wallet-withdraw', async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    const user = await requireUser(req);
    const request = parseWithdrawRequest(await readJson(req));
    const db = adminClient();

    const pixKey = await db
      .from('pix_keys')
      .select('id, masked_value')
      .eq('id', request.pixKeyId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (pixKey.error) throw pixKey.error;
    if (!pixKey.data) throw new HttpError(404, 'not_found', 'Chave Pix não encontrada.');
    const destinationLabel = pixKey.data.masked_value as string;

    const merchant = request.source === 'qi_client' ? null : await merchantContext(db, user.id);
    const businessId = merchant?.businessId ?? null;
    const key = withdrawalIdempotencyKey(user.id, request.idempotencyKey);

    // Retry com a mesma chave: retoma o saque existente (o saldo já foi
    // debitado, então o plano não é refeito).
    const prior = await db
      .from('withdrawals')
      .select('id, fee_cents')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (prior.error) throw prior.error;

    let result: BeginResult;
    let feeCents: number;
    if (prior.data) {
      feeCents = prior.data.fee_cents as number;
      result = await begin(
        db,
        {
          id: prior.data.id,
          source: request.source,
          business_id: businessId,
          user_id: user.id,
          amount_cents: request.amountCents,
          fee_cents: feeCents,
          idempotency_key: key,
          status: 'processing',
        },
        [],
      );
    } else {
      const withdrawalId = crypto.randomUUID();
      const plan = planWithdraw({
        withdrawalId,
        source: request.source,
        amountCents: request.amountCents,
        balanceCents: await balanceCents(db, request, user.id, businessId),
        businessId,
        userId: user.id,
        destinationLabel,
        account: merchant?.account ?? null,
      });
      if (!plan.ok) {
        throw new HttpError(PLAN_ERROR_STATUS[plan.code] ?? 400, plan.code as ErrorCode);
      }
      feeCents = plan.quote.feeCents;
      result = await begin(
        db,
        {
          id: withdrawalId,
          source: request.source,
          business_id: businessId,
          user_id: user.id,
          amount_cents: request.amountCents,
          fee_cents: feeCents,
          pix_key_id: request.pixKeyId,
          destination_label: destinationLabel,
          idempotency_key: key,
          status: plan.status,
        },
        ledgerToRpc(plan.ledger),
      );
    }

    const body = (status: string) => ({
      withdrawalId: result.withdrawal_id,
      status,
      amountCents: request.amountCents,
      feeCents,
      netCents: request.amountCents - feeCents,
    });

    if (result.status !== 'processing') return json(body(result.status));

    if (!merchant?.accountId || merchant.account?.disconnected) {
      throw new HttpError(409, 'payout_account_inactive');
    }
    const { failure, firstTransferId } = await runTransfers(
      db,
      result.withdrawal_id,
      merchant.accountId,
      result.transfers,
    );

    if (failure) {
      const failed = await db.rpc('fail_withdrawal', {
        p_withdrawal_id: result.withdrawal_id,
        p_failure_code: failure,
      });
      if (failed.error) throw failed.error;
      const fullyFailed = (failed.data as { failed?: boolean } | null)?.failed === true;
      throw new HttpError(
        502,
        'provider_error',
        fullyFailed ? `withdraw_failed:${failure}` : `withdraw_partial:${failure}`,
      );
    }

    const done = await db
      .from('withdrawals')
      .update({ status: 'paid', provider_transfer_id: firstTransferId })
      .eq('id', result.withdrawal_id);
    if (done.error) throw done.error;
    return json(body('paid'));
  }),
);
