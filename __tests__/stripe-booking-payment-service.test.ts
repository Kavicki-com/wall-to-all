/**
 * StripeBookingPaymentService (F8, Task 12): o registro de pagamento do
 * agendamento lido de `payments`. "Pago" só existe se o banco diz `succeeded`;
 * "pagar na hora" é o RPC `record_pay_on_site`; desistência é `payments-cancel`.
 */
import { StripeBookingPaymentService } from '../lib/services/stripe/stripeBookingPaymentService';

type Result = { data: unknown; error: unknown };

const mockInvoke = jest.fn();
const mockRpc = jest.fn();
const mockPaymentsResult: { current: Result } = { current: { data: null, error: null } };
const mockCalls: unknown[][] = [];

jest.mock('../lib/supabase', () => {
  const buildQuery = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        mockCalls.push([method, ...args]);
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(mockPaymentsResult.current);
    return builder;
  };
  return {
    supabase: {
      functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
      rpc: (...args: unknown[]) => mockRpc(...args),
      from: () => buildQuery(),
    },
  };
});

function row(fields: Record<string, unknown>) {
  mockPaymentsResult.current = {
    data: {
      status: 'succeeded',
      method: 'card',
      amount_cents: 6500,
      card_last4: '4242',
      card_brand: 'visa',
      paid_at: '2026-11-02T10:00:00Z',
      ...fields,
    },
    error: null,
  };
}

const svc = () => new StripeBookingPaymentService();

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockPaymentsResult.current = { data: null, error: null };
});

describe('StripeBookingPaymentService', () => {
  it('avisa que a notificação do pagamento online sai do servidor', () => {
    expect(svc().serverNotifiesOnPayment).toBe(true);
  });

  it('getPayment: succeeded com cartão vira paid', async () => {
    row({});
    await expect(svc().getPayment(77)).resolves.toEqual({
      appointmentId: 77,
      status: 'paid',
      method: 'card',
      amountCents: 6500,
      cardLast4: '4242',
      cardBrand: 'visa',
      paidAt: '2026-11-02T10:00:00Z',
    });
    expect(mockCalls).toContainEqual(['eq', 'appointment_id', 77]);
    expect(mockCalls).toContainEqual(['eq', 'purpose', 'booking']);
    expect(mockCalls).toContainEqual(['in', 'status', ['succeeded', 'pay_on_site']]);
  });

  it('getPayment: pay_on_site vira pay_on_site sem cartão', async () => {
    row({
      status: 'pay_on_site',
      method: 'cash',
      card_last4: null,
      card_brand: null,
      paid_at: null,
    });
    await expect(svc().getPayment(77)).resolves.toMatchObject({
      status: 'pay_on_site',
      method: 'cash',
      cardLast4: null,
      cardBrand: null,
      paidAt: null,
    });
  });

  it('getPayment: bandeira desconhecida vira null; sem linha, null', async () => {
    row({ card_brand: 'discover' });
    await expect(svc().getPayment(77)).resolves.toMatchObject({ cardBrand: null });

    mockPaymentsResult.current = { data: null, error: null };
    await expect(svc().getPayment(77)).resolves.toBeNull();
  });

  it('recordPayment paid só confirma o que o banco já diz', async () => {
    row({});
    await expect(
      svc().recordPayment(77, {
        status: 'paid',
        method: 'card',
        amountCents: 6500,
        cardLast4: '4242',
        cardBrand: 'visa',
      }),
    ).resolves.toMatchObject({ status: 'paid' });

    mockPaymentsResult.current = { data: null, error: null };
    await expect(
      svc().recordPayment(77, {
        status: 'paid',
        method: 'pix',
        amountCents: 6500,
        cardLast4: null,
        cardBrand: null,
      }),
    ).rejects.toThrow(/não confirmado/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('recordPayment pay_on_site chama o RPC', async () => {
    mockRpc.mockResolvedValue({ data: 'pay-uuid', error: null });
    await expect(
      svc().recordPayment(77, {
        status: 'pay_on_site',
        method: 'cash',
        amountCents: 6500,
        cardLast4: null,
        cardBrand: null,
      }),
    ).resolves.toEqual({
      appointmentId: 77,
      status: 'pay_on_site',
      method: 'cash',
      amountCents: 6500,
      cardLast4: null,
      cardBrand: null,
      paidAt: null,
    });
    expect(mockRpc).toHaveBeenCalledWith('record_pay_on_site', { p_appointment_id: 77 });
  });

  it('cancelUnpaid chama payments-cancel; já pago (invalid_state) é ignorado', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { appointmentId: 77, status: 'canceled' },
      error: null,
    });
    await svc().cancelUnpaid(77);
    expect(mockInvoke).toHaveBeenCalledWith('payments-cancel', {
      method: 'POST',
      body: { appointmentId: 77 },
    });

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        context: { status: 409, json: () => Promise.resolve({ error: { code: 'invalid_state' } }) },
      },
    });
    await expect(svc().cancelUnpaid(77)).resolves.toBeUndefined();

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        context: { status: 500, json: () => Promise.resolve({ error: { code: 'internal' } }) },
      },
    });
    await expect(svc().cancelUnpaid(77)).rejects.toThrow();
  });
});
