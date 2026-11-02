/**
 * Evento de dinheiro -> lançamentos de ledger (design § 5, § 10). Puro.
 *
 * Convenções: valores em centavos com sinal (crédito positivo); um lançamento
 * por (pagamento ou saque, conta, tipo), que é o unique da tabela; nada de
 * lançamento zerado. Títulos e subtítulos seguem a copy do extrato mock
 * (`lib/services/mock/mockWalletService.ts`).
 */

import type { FundsFlow, PaymentPurposeKind } from './fundsFlow.ts';

export type LedgerAccount = 'merchant' | 'merchant_qi' | 'client_qi' | 'platform';
export type LedgerKind =
  | 'service'
  | 'fura_fila'
  | 'platform_fee'
  | 'withdraw'
  | 'withdraw_fee'
  | 'qi_cashback'
  | 'qi_withdraw'
  | 'refund';

export interface LedgerEntryDraft {
  account: LedgerAccount;
  kind: LedgerKind;
  amountCents: number;
  businessId: number | null;
  userId: string | null;
  paymentId: string | null;
  withdrawalId: string | null;
  title: string;
  subtitle: string;
}

/** Pagamento já liquidado, com os dados que o webhook lê do banco. */
export interface SettledPayment {
  id: string;
  purpose: PaymentPurposeKind;
  fundsFlow: FundsFlow;
  amountCents: number;
  platformFeeCents: number;
  merchantBusinessId: number | null;
  /** Nome do serviço (booking); null no fura-fila. */
  serviceName: string | null;
  /** Nome do cliente pagador, mostrado no extrato do lojista. */
  payerName: string;
}

export interface LedgerContext {
  /** Só test mode: negócio que recebe a parte do lojista no fura-fila. */
  demoBusinessId?: number | null;
}

export const FURA_FILA_TITLE = 'Furou Fila';
export const FURA_FILA_SUBTITLE = 'Taxa de antecipação Fura Fila';
export const PLATFORM_FEE_TITLE = 'Taxa da plataforma';
export const WITHDRAW_TITLE = 'Saque';
export const WITHDRAW_FEE_TITLE = 'Taxa de saque';
export const REFUND_TITLE = 'Estorno';

function entry(
  partial: Pick<LedgerEntryDraft, 'account' | 'kind' | 'amountCents' | 'title' | 'subtitle'> &
    Partial<LedgerEntryDraft>,
): LedgerEntryDraft {
  return {
    businessId: null,
    userId: null,
    paymentId: null,
    withdrawalId: null,
    ...partial,
  };
}

/** Lançamentos de um pagamento que chegou a `succeeded`. */
export function entriesForSucceeded(
  payment: SettledPayment,
  ctx: LedgerContext,
): LedgerEntryDraft[] {
  const { id, amountCents, platformFeeCents } = payment;
  if (
    !Number.isInteger(platformFeeCents) ||
    platformFeeCents < 0 ||
    platformFeeCents > amountCents
  ) {
    throw new Error(`Taxa da plataforma inválida no pagamento ${id}.`);
  }
  const netCents = amountCents - platformFeeCents;

  if (payment.purpose === 'subscription') {
    return [
      entry({
        account: 'platform',
        kind: 'service',
        amountCents,
        paymentId: id,
        title: 'Assinatura',
        subtitle: payment.payerName,
      }),
    ];
  }

  if (payment.purpose === 'fura_fila') {
    const businessId = ctx.demoBusinessId ?? null;
    if (businessId === null) {
      return [
        entry({
          account: 'platform',
          kind: 'fura_fila',
          amountCents,
          paymentId: id,
          title: FURA_FILA_TITLE,
          subtitle: payment.payerName,
        }),
      ];
    }
    return withFee(
      entry({
        account: 'merchant',
        kind: 'fura_fila',
        amountCents: netCents,
        businessId,
        paymentId: id,
        title: FURA_FILA_TITLE,
        subtitle: FURA_FILA_SUBTITLE,
      }),
      id,
      platformFeeCents,
      FURA_FILA_TITLE,
    );
  }

  if (payment.merchantBusinessId === null) {
    throw new Error(`Pagamento de agendamento ${id} sem negócio.`);
  }
  const serviceName = payment.serviceName ?? 'Serviço';
  return withFee(
    entry({
      account: 'merchant',
      kind: 'service',
      amountCents: netCents,
      businessId: payment.merchantBusinessId,
      paymentId: id,
      title: serviceName,
      subtitle: payment.payerName,
    }),
    id,
    platformFeeCents,
    serviceName,
  );
}

function withFee(
  merchantEntry: LedgerEntryDraft,
  paymentId: string,
  feeCents: number,
  feeSubtitle: string,
): LedgerEntryDraft[] {
  const entries = [merchantEntry];
  if (feeCents > 0) {
    entries.push(
      entry({
        account: 'platform',
        kind: 'platform_fee',
        amountCents: feeCents,
        paymentId,
        title: PLATFORM_FEE_TITLE,
        subtitle: feeSubtitle,
      }),
    );
  }
  return entries;
}

/** Estorno total: espelha os lançamentos do pagamento com sinal invertido. */
export function entriesForRefund(payment: SettledPayment, ctx: LedgerContext): LedgerEntryDraft[] {
  return entriesForSucceeded(payment, ctx).map((original) => ({
    ...original,
    kind: 'refund' as const,
    amountCents: -original.amountCents,
    title: REFUND_TITLE,
    subtitle: original.title,
  }));
}

export type WithdrawalSource = 'financeiro' | 'qi_merchant' | 'qi_client';

export interface WithdrawalDraft {
  id: string;
  source: WithdrawalSource;
  /** Valor pedido (bruto), debitado do saldo. */
  amountCents: number;
  feeCents: number;
  businessId: number | null;
  userId: string;
  /** Rótulo do destino (chave Pix mascarada), como no extrato mock. */
  destinationLabel: string;
}

/** Saque: debita o valor pedido da conta de origem e credita a taxa à plataforma. */
export function entriesForWithdraw(withdrawal: WithdrawalDraft): LedgerEntryDraft[] {
  const { id, source, amountCents, feeCents } = withdrawal;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`Valor inválido no saque ${id}.`);
  }
  if (!Number.isInteger(feeCents) || feeCents < 0 || feeCents >= amountCents) {
    throw new Error(`Taxa inválida no saque ${id}.`);
  }

  let debit: LedgerEntryDraft;
  if (source === 'qi_client') {
    debit = entry({
      account: 'client_qi',
      kind: 'qi_withdraw',
      amountCents: -amountCents,
      userId: withdrawal.userId,
      withdrawalId: id,
      title: WITHDRAW_TITLE,
      subtitle: withdrawal.destinationLabel,
    });
  } else {
    if (withdrawal.businessId === null) {
      throw new Error(`Saque de lojista ${id} sem negócio.`);
    }
    debit = entry({
      account: source === 'financeiro' ? 'merchant' : 'merchant_qi',
      kind: source === 'financeiro' ? 'withdraw' : 'qi_withdraw',
      amountCents: -amountCents,
      businessId: withdrawal.businessId,
      withdrawalId: id,
      title: WITHDRAW_TITLE,
      subtitle: withdrawal.destinationLabel,
    });
  }

  const entries = [debit];
  if (feeCents > 0) {
    entries.push(
      entry({
        account: 'platform',
        kind: 'withdraw_fee',
        amountCents: feeCents,
        withdrawalId: id,
        title: WITHDRAW_FEE_TITLE,
        subtitle: WITHDRAW_TITLE,
      }),
    );
  }
  return entries;
}
