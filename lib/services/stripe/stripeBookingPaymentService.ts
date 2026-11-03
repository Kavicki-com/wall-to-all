/**
 * `BookingPaymentService` com pagamentos reais (F8, design § 7).
 *
 * O registro do pagamento do agendamento é a linha em `payments` (RLS do
 * pagador). "Pago" é escrito só pelo webhook; aqui `recordPayment('paid')`
 * apenas confere o banco. "Pagar na hora" é o RPC `record_pay_on_site`.
 * Desistência antes de pagar é `payments-cancel` (cancela o PaymentIntent e
 * libera o horário).
 */

import { supabase } from '../../supabase';
import type {
  BookingPayment,
  BookingPaymentInput,
  BookingPaymentMethod,
  BookingPaymentService,
} from '../bookingTypes';
import type { CardBrand } from '../types';
import { invokeEdge, PaymentsApiError } from './edgeClient';

const CARD_BRANDS: ReadonlySet<string> = new Set<CardBrand>(['visa', 'mastercard', 'elo', 'amex']);

interface BookingPaymentRow {
  status: 'succeeded' | 'pay_on_site';
  method: BookingPaymentMethod;
  amount_cents: number;
  card_last4: string | null;
  card_brand: string | null;
  paid_at: string | null;
}

export class StripeBookingPaymentService implements BookingPaymentService {
  /** O webhook avisa o lojista no `payment_intent.succeeded` (design § 16). */
  readonly serverNotifiesOnPayment = true;

  async getPayment(appointmentId: number): Promise<BookingPayment | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('status, method, amount_cents, card_last4, card_brand, paid_at')
      .eq('appointment_id', appointmentId)
      .eq('purpose', 'booking')
      .in('status', ['succeeded', 'pay_on_site'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as BookingPaymentRow;
    const paid = row.status === 'succeeded';
    const isCard = paid && row.method === 'card';
    return {
      appointmentId,
      status: paid ? 'paid' : 'pay_on_site',
      method: row.method,
      amountCents: row.amount_cents,
      cardLast4: isCard ? row.card_last4 : null,
      cardBrand:
        isCard && row.card_brand && CARD_BRANDS.has(row.card_brand)
          ? (row.card_brand as CardBrand)
          : null,
      paidAt: paid ? row.paid_at : null,
    };
  }

  async recordPayment(
    appointmentId: number,
    payment: BookingPaymentInput,
  ): Promise<BookingPayment> {
    if (payment.status === 'paid') {
      // O app nunca grava "pago": só confirma o que o webhook já gravou.
      const current = await this.getPayment(appointmentId);
      if (!current || current.status !== 'paid') {
        throw new Error('Pagamento ainda não confirmado.');
      }
      return current;
    }
    const { error } = await supabase.rpc('record_pay_on_site', {
      p_appointment_id: appointmentId,
    });
    if (error) throw error;
    return {
      appointmentId,
      status: 'pay_on_site',
      method: payment.method,
      amountCents: payment.amountCents,
      cardLast4: null,
      cardBrand: null,
      paidAt: null,
    };
  }

  async cancelUnpaid(appointmentId: number): Promise<void> {
    try {
      await invokeEdge('payments-cancel', { body: { appointmentId } });
    } catch (err) {
      // Já pago ou em liquidação: fica intacto (contrato da interface).
      if (err instanceof PaymentsApiError && err.code === 'invalid_state') return;
      throw err;
    }
  }
}
