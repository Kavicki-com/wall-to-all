import type { CardBrand } from './types';

/**
 * Contrato do registro de pagamento de um agendamento (F5).
 *
 * O agendamento em si é gravado no Supabase real (`appointments`), mas o
 * schema ainda não tem colunas de pagamento: a cobrança é mock (WalletService)
 * e o RESULTADO dela (pago via pix/cartão, ou pagar na hora) vive aqui, em
 * memória, até a F8 trocar este serviço por uma tabela + PSP. Fica fora de
 * `types.ts` de propósito (território de outras fases); importar direto deste
 * módulo, sem re-export.
 */

/** Espelha o enum `payment_method` do Supabase. */
export type BookingPaymentMethod = 'pix' | 'card' | 'cash';
export type BookingPaymentStatus = 'paid' | 'pay_on_site';

export interface BookingPayment {
  appointmentId: number;
  status: BookingPaymentStatus;
  method: BookingPaymentMethod;
  amountCents: number;
  /** Só quando method === 'card' e status === 'paid'. */
  cardLast4: string | null;
  cardBrand: CardBrand | null;
  /** ISO 8601; null em pay_on_site. */
  paidAt: string | null;
}

export type BookingPaymentInput = Omit<BookingPayment, 'appointmentId' | 'paidAt'>;

export interface BookingPaymentService {
  /** Idempotente por appointmentId (regrava). Rejeita amount <= 0, 'paid' com 'cash', e 'paid' + 'card' sem last4. */
  recordPayment(appointmentId: number, payment: BookingPaymentInput): Promise<BookingPayment>;
  getPayment(appointmentId: number): Promise<BookingPayment | null>;
}
