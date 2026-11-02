/**
 * Linhas do banco (F8) -> tipos de `lib/services/types.ts`. Puro.
 */

import type { PaymentStatus, PixKey, PixKeyType, WalletEntry, WalletEntryKind } from '../types';

export interface PixKeyRow {
  id: string;
  type: PixKeyType;
  masked_value: string;
  created_at: string;
}

export function mapPixKey(row: PixKeyRow): PixKey {
  return { id: row.id, type: row.type, maskedValue: row.masked_value, createdAt: row.created_at };
}

export interface PayerPaymentRow {
  id: string;
  purpose: 'booking' | 'fura_fila' | 'subscription';
  method: string;
  amount_cents: number;
  paid_at: string | null;
  created_at: string;
}

const PURPOSE_TITLE: Record<PayerPaymentRow['purpose'], string> = {
  booking: 'Agendamento',
  fura_fila: 'Furou Fila',
  subscription: 'Assinatura',
};

/** Pagamento feito pelo cliente: débito no extrato dele. */
export function mapPayerPayment(row: PayerPaymentRow): WalletEntry {
  return {
    id: row.id,
    kind: row.purpose === 'fura_fila' ? 'fura_fila' : 'service',
    title: PURPOSE_TITLE[row.purpose] ?? 'Pagamento',
    subtitle: row.method === 'pix' ? 'Pix' : 'Cartão',
    amountCents: -row.amount_cents,
    date: row.paid_at ?? row.created_at,
  };
}

export interface LedgerRow {
  id: number | string;
  kind: string;
  amount_cents: number;
  title: string;
  subtitle: string;
  created_at: string;
  withdrawal_id: string | null;
}

/**
 * Lançamento da conta `merchant` -> linha do extrato do Financeiro. A taxa de
 * saque não aparece separada: o débito do saque já é o valor bruto pedido (a
 * taxa vai para a conta da plataforma). Estorno de saque falho conta como
 * saque; estorno de pagamento, como serviço.
 */
export function mapMerchantLedger(row: LedgerRow): WalletEntry {
  let kind: WalletEntryKind;
  if (row.kind === 'fura_fila') kind = 'fura_fila';
  else if (row.kind === 'withdraw' || row.withdrawal_id) kind = 'withdraw';
  else kind = 'service';
  return {
    id: String(row.id),
    kind,
    title: row.title,
    subtitle: row.subtitle,
    amountCents: row.amount_cents,
    date: row.created_at,
  };
}

/** `pay_on_site` não é cobrança online: para o polling, nunca é estado final. */
export function mapPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case 'requires_payment':
    case 'requires_action':
    case 'processing':
    case 'succeeded':
    case 'failed':
    case 'canceled':
    case 'refunded':
      return status;
    default:
      return 'requires_payment';
  }
}
