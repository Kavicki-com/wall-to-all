import type { BookingPayment, BookingPaymentInput, BookingPaymentService } from '../bookingTypes';

/**
 * Latência simulada (ms) para uso no app real. Mesmo design do
 * MockWalletService: o construtor aceita `latencyMs` com default **0** (testes
 * resolvem via microtask), e o ServicesProvider passa `SIMULATED_LATENCY_MS`
 * explicitamente para simular latência de rede realista dentro do app.
 */
export const SIMULATED_LATENCY_MS = 300;

export interface MockBookingPaymentServiceOptions {
  /** Latência simulada (ms) das operações. Default 0 (ver SIMULATED_LATENCY_MS). */
  latencyMs?: number;
}

/**
 * Registro em memória do pagamento de cada agendamento, indexado pelo id do
 * appointment do Supabase. Sem persistência: some ao recarregar o app, o que é
 * aceitável enquanto o pagamento é mock (a F8 troca por tabela + PSP).
 */
export class MockBookingPaymentService implements BookingPaymentService {
  private readonly latencyMs: number;
  private readonly payments = new Map<number, BookingPayment>();

  constructor(options: MockBookingPaymentServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
  }

  async recordPayment(
    appointmentId: number,
    payment: BookingPaymentInput,
  ): Promise<BookingPayment> {
    await this.delay();
    if (payment.amountCents <= 0) {
      throw new Error('O valor do pagamento deve ser maior que zero.');
    }
    if (payment.status === 'paid' && payment.method === 'cash') {
      throw new Error('Pagamento em dinheiro só pode ser feito na hora.');
    }
    if (payment.status === 'paid' && payment.method === 'card' && !payment.cardLast4) {
      throw new Error('Pagamento com cartão exige os últimos dígitos do cartão.');
    }

    const record: BookingPayment = {
      ...payment,
      appointmentId,
      paidAt: payment.status === 'paid' ? new Date().toISOString() : null,
    };
    this.payments.set(appointmentId, record);
    return { ...record };
  }

  async getPayment(appointmentId: number): Promise<BookingPayment | null> {
    await this.delay();
    const record = this.payments.get(appointmentId);
    return record ? { ...record } : null;
  }

  /**
   * Latência simulada: com latencyMs === 0 resolve via microtask para manter
   * os testes rápidos; com > 0 usa setTimeout de verdade.
   */
  private async delay(): Promise<void> {
    if (this.latencyMs === 0) {
      await Promise.resolve();
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
