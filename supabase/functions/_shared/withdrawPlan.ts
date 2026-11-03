/**
 * Pedido de saque -> decisão e lançamentos (design § 16). Puro.
 *
 * Modelo do piloto: a plataforma segura os fundos. "Sacar" (Financeiro e QI
 * do lojista) vira transfers da plataforma para a conta conectada, cada um com
 * `source_transaction` numa cobrança ainda não repassada; a taxa de saque
 * simplesmente não é transferida. O payout para o banco é o automático da
 * Stripe. QI do cliente não tem primitiva Stripe: vira `manual_pending`.
 *
 * A alocação sobre as cobranças e a checagem final do saldo acontecem no
 * banco (`begin_withdrawal`, sob lock); aqui fica o que não depende de estado.
 */

import { payoutAccountStatus } from './accountFlags.ts';
import { HttpError, type ErrorCode } from './http.ts';
import { entriesForWithdraw, type LedgerEntryDraft, type WithdrawalSource } from './ledger.ts';
import { MIN_WITHDRAW_CENTS, quoteWithdraw, type WithdrawQuote } from './pricing.ts';

export interface WithdrawRequest {
  source: WithdrawalSource;
  amountCents: number;
  pixKeyId: string;
  /** Gerada pelo app por tentativa de saque; o retry reaproveita. */
  idempotencyKey: string;
}

const SOURCES: WithdrawalSource[] = ['financeiro', 'qi_merchant', 'qi_client'];

export function parseWithdrawRequest(body: Record<string, unknown>): WithdrawRequest {
  const { source, amountCents, pixKeyId, idempotencyKey } = body;
  if (typeof source !== 'string' || !SOURCES.includes(source as WithdrawalSource)) {
    throw new HttpError(400, 'bad_request', 'source inválido.');
  }
  if (typeof amountCents !== 'number') {
    throw new HttpError(400, 'bad_request', 'amountCents inválido.');
  }
  if (typeof pixKeyId !== 'string' || pixKeyId.length === 0) {
    throw new HttpError(400, 'bad_request', 'pixKeyId inválido.');
  }
  if (
    typeof idempotencyKey !== 'string' ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 200
  ) {
    throw new HttpError(400, 'bad_request', 'idempotencyKey inválida.');
  }
  return { source: source as WithdrawalSource, amountCents, pixKeyId, idempotencyKey };
}

/** A chave do app é por usuário: dois usuários nunca colidem. */
export function withdrawalIdempotencyKey(userId: string, appKey: string): string {
  return `withdraw:${userId}:${appKey}`;
}

export interface WithdrawInput {
  withdrawalId: string;
  source: WithdrawalSource;
  amountCents: number;
  /** Saldo atual da conta de origem no ledger. */
  balanceCents: number;
  businessId: number | null;
  userId: string;
  destinationLabel: string;
  /** Conta de recebimento do negócio (ignorada no QI do cliente). */
  account: { payoutsEnabled: boolean; disconnected: boolean } | null;
}

export type WithdrawPlan =
  | {
      ok: false;
      code: Extract<
        ErrorCode,
        'bad_request' | 'below_minimum' | 'insufficient_balance' | 'payout_account_inactive'
      >;
    }
  | {
      ok: true;
      status: 'processing' | 'manual_pending';
      /** true: transferir `quote.totalCents` para a conta conectada. */
      transfer: boolean;
      quote: WithdrawQuote;
      ledger: LedgerEntryDraft[];
    };

export function planWithdraw(input: WithdrawInput): WithdrawPlan {
  const { source, amountCents } = input;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, code: 'bad_request' };
  }
  const quote = quoteWithdraw(amountCents);
  const isQi = source !== 'financeiro';
  if ((isQi && amountCents < MIN_WITHDRAW_CENTS) || quote.totalCents <= 0) {
    return { ok: false, code: 'below_minimum' };
  }

  const toMerchant = source !== 'qi_client';
  if (toMerchant && payoutAccountStatus(input.account) !== 'active') {
    return { ok: false, code: 'payout_account_inactive' };
  }
  if (input.balanceCents < amountCents) {
    return { ok: false, code: 'insufficient_balance' };
  }

  const ledger = entriesForWithdraw({
    id: input.withdrawalId,
    source,
    amountCents,
    feeCents: quote.feeCents,
    businessId: toMerchant ? input.businessId : null,
    userId: input.userId,
    destinationLabel: input.destinationLabel,
  });

  return {
    ok: true,
    status: toMerchant ? 'processing' : 'manual_pending',
    transfer: toMerchant,
    quote,
    ledger,
  };
}

/** Exceções do `begin_withdrawal` (mensagem da exceção) -> código do app. */
export function dbWithdrawError(message: string): ErrorCode | null {
  switch (message) {
    case 'insufficient_balance':
      return 'insufficient_balance';
    case 'no_transfer_source':
      return 'invalid_state';
    case 'idempotency_key_reused':
      return 'conflict';
    default:
      return null;
  }
}
