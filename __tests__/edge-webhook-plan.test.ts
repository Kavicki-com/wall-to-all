import {
  appointmentRequestedMessage,
  ledgerToRpc,
  paymentLookup,
  planForEvent,
  type PaymentContext,
  type StripeEventShape,
} from '../supabase/functions/_shared/webhookPlan.ts';
import { accountFlags } from '../supabase/functions/_shared/accountFlags.ts';

const bookingPayment: PaymentContext = {
  id: '00000000-0000-0000-0000-0000000000a1',
  purpose: 'booking',
  fundsFlow: 'platform',
  amountCents: 6500,
  platformFeeCents: 650,
  merchantBusinessId: 39,
  serviceName: 'Corte Demo',
  payerName: 'Cliente QA',
  status: 'requires_payment',
  method: 'card',
  appointmentId: 85,
  merchantOwnerId: '00000000-0000-0000-0000-0000000000b1',
  appointmentStartTime: '2026-11-09T13:00:00.000Z',
};

const furaFilaPayment: PaymentContext = {
  ...bookingPayment,
  id: '00000000-0000-0000-0000-0000000000a2',
  purpose: 'fura_fila',
  amountCents: 1500,
  platformFeeCents: 0,
  merchantBusinessId: null,
  serviceName: null,
  method: 'pix',
  appointmentId: null,
  merchantOwnerId: null,
  appointmentStartTime: null,
};

function intentEvent(
  type: string,
  object: Record<string, unknown> = {},
  paymentId = bookingPayment.id,
): StripeEventShape {
  return {
    id: 'evt_test_1',
    type,
    data: {
      object: {
        id: 'pi_test_1',
        object: 'payment_intent',
        metadata: { payment_id: paymentId },
        ...object,
      },
    },
  };
}

const ctx = (payment: PaymentContext | null, extra = {}) => ({
  payment,
  charge: null,
  demoBusinessId: null,
  ...extra,
});

describe('paymentLookup', () => {
  it('PaymentIntent: pelo metadata.payment_id', () => {
    expect(paymentLookup(intentEvent('payment_intent.succeeded'))).toEqual({
      paymentId: bookingPayment.id,
    });
  });

  it('charge: pelo payment_intent', () => {
    expect(
      paymentLookup({
        id: 'evt_c',
        type: 'charge.refunded',
        data: { object: { id: 'ch_1', object: 'charge', payment_intent: 'pi_test_1' } },
      }),
    ).toEqual({ providerPaymentId: 'pi_test_1' });
  });

  it('PI sem metadata (ex.: spike) e eventos de conta: null', () => {
    expect(paymentLookup(intentEvent('payment_intent.succeeded', { metadata: {} }))).toBeNull();
    expect(
      paymentLookup({ id: 'e', type: 'account.updated', data: { object: { id: 'acct_1' } } }),
    ).toBeNull();
  });
});

describe('planForEvent: cashback QI', () => {
  const qi = { referrer: { userId: 'user_ref', businessId: null }, perServicePct: 10 };

  it('succeeded de agendamento com indicador credita o client_qi', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.succeeded', { status: 'succeeded' }),
      ctx(bookingPayment, { qi }),
    );
    if (plan.kind !== 'payment') throw new Error('esperava plano de pagamento');
    expect(plan.ledger).toContainEqual(
      expect.objectContaining({ account: 'client_qi', kind: 'qi_cashback', userId: 'user_ref' }),
    );
  });

  it('sem contexto de QI: nenhum lançamento de cashback', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.succeeded', { status: 'succeeded' }),
      ctx(bookingPayment),
    );
    if (plan.kind !== 'payment') throw new Error('esperava plano de pagamento');
    expect(plan.ledger.some((e) => e.kind === 'qi_cashback')).toBe(false);
  });
});

describe('planForEvent: PaymentIntent', () => {
  it('succeeded de booking: status, cartão do charge, ledger e notificação', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.succeeded', { status: 'succeeded' }),
      ctx(bookingPayment, { charge: { last4: '4242', brand: 'visa' } }),
    );
    expect(plan).toEqual({
      kind: 'payment',
      paymentId: bookingPayment.id,
      status: 'succeeded',
      fields: { provider_payment_id: 'pi_test_1', card_last4: '4242', card_brand: 'visa' },
      ledger: [
        expect.objectContaining({
          account: 'merchant',
          kind: 'service',
          amountCents: 5850,
          businessId: 39,
        }),
        expect.objectContaining({ account: 'platform', kind: 'platform_fee', amountCents: 650 }),
      ],
      cancelAppointment: false,
      notifyMerchant: {
        userId: bookingPayment.merchantOwnerId,
        appointmentId: 85,
        type: 'appointment_requested',
        title: 'Nova Solicitação de Agendamento',
        message: appointmentRequestedMessage(
          'Cliente QA',
          'Corte Demo',
          '2026-11-09T13:00:00.000Z',
        ),
      },
    });
  });

  it('succeeded de fura-fila sem demoBusinessId: só a plataforma, sem notificação', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.succeeded', {}, furaFilaPayment.id),
      ctx(furaFilaPayment),
    );
    expect(plan.kind).toBe('payment');
    if (plan.kind !== 'payment') return;
    expect(plan.ledger).toEqual([
      expect.objectContaining({ account: 'platform', kind: 'fura_fila', amountCents: 1500 }),
    ]);
    expect(plan.notifyMerchant).toBeNull();
    expect(plan.fields).toEqual({ provider_payment_id: 'pi_test_1' });
  });

  it('succeeded de fura-fila com demoBusinessId: credita o lojista demo', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.succeeded', {}, furaFilaPayment.id),
      ctx(furaFilaPayment, { demoBusinessId: 39 }),
    );
    if (plan.kind !== 'payment') throw new Error('esperado payment');
    expect(plan.ledger).toEqual([
      expect.objectContaining({
        account: 'merchant',
        kind: 'fura_fila',
        businessId: 39,
        amountCents: 1500,
      }),
    ]);
  });

  it('payment_failed: failed com o código da recusa, sem ledger', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.payment_failed', {
        last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds' },
      }),
      ctx(bookingPayment),
    );
    expect(plan).toMatchObject({
      kind: 'payment',
      status: 'failed',
      fields: { provider_payment_id: 'pi_test_1', failure_code: 'insufficient_funds' },
      ledger: [],
      cancelAppointment: false,
      notifyMerchant: null,
    });
  });

  it('canceled de booking (Pix expirado): cancela o agendamento', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.canceled'),
      ctx({ ...bookingPayment, method: 'pix', status: 'requires_action' }),
    );
    expect(plan).toMatchObject({
      kind: 'payment',
      status: 'canceled',
      cancelAppointment: true,
      ledger: [],
    });
  });

  it('processing e requires_action são informativos', () => {
    expect(
      planForEvent(intentEvent('payment_intent.processing'), ctx(bookingPayment)),
    ).toMatchObject({
      kind: 'payment',
      status: 'processing',
      ledger: [],
    });
    expect(
      planForEvent(intentEvent('payment_intent.requires_action'), ctx(bookingPayment)),
    ).toMatchObject({ kind: 'payment', status: 'requires_action' });
  });

  it('evento atrasado depois de succeeded é ignorado', () => {
    expect(
      planForEvent(
        intentEvent('payment_intent.processing'),
        ctx({ ...bookingPayment, status: 'succeeded' }),
      ),
    ).toEqual({ kind: 'ignore', reason: 'stale' });
  });

  it('pagamento desconhecido é ignorado (não quebra o webhook)', () => {
    expect(planForEvent(intentEvent('payment_intent.succeeded'), ctx(null))).toEqual({
      kind: 'ignore',
      reason: 'unknown_payment',
    });
  });
});

describe('planForEvent: charge.refunded', () => {
  const refunded = (full: boolean): StripeEventShape => ({
    id: 'evt_r',
    type: 'charge.refunded',
    data: { object: { id: 'ch_1', object: 'charge', payment_intent: 'pi_test_1', refunded: full } },
  });

  it('estorno total: refunded e ledger invertido', () => {
    const plan = planForEvent(refunded(true), ctx({ ...bookingPayment, status: 'succeeded' }));
    if (plan.kind !== 'payment') throw new Error('esperado payment');
    expect(plan.status).toBe('refunded');
    expect(plan.ledger).toEqual([
      expect.objectContaining({ account: 'merchant', kind: 'refund', amountCents: -5850 }),
      expect.objectContaining({ account: 'platform', kind: 'refund', amountCents: -650 }),
    ]);
  });

  it('estorno parcial fica fora do piloto', () => {
    expect(planForEvent(refunded(false), ctx({ ...bookingPayment, status: 'succeeded' }))).toEqual({
      kind: 'ignore',
      reason: 'partial_refund',
    });
  });
});

describe('planForEvent: Connect e eventos sem efeito', () => {
  const account = {
    id: 'acct_test_1',
    object: 'account',
    charges_enabled: true,
    payouts_enabled: false,
    details_submitted: true,
    requirements: { currently_due: ['external_account'], past_due: [] },
  };

  it('account.updated atualiza as flags', () => {
    expect(
      planForEvent(
        { id: 'evt_a', type: 'account.updated', account: 'acct_test_1', data: { object: account } },
        ctx(null),
      ),
    ).toEqual({
      kind: 'account',
      accountId: 'acct_test_1',
      flags: accountFlags(account),
      disconnected: false,
    });
  });

  it('account.application.deauthorized marca a conta como desconectada', () => {
    expect(
      planForEvent(
        {
          id: 'evt_d',
          type: 'account.application.deauthorized',
          account: 'acct_test_1',
          data: { object: { id: 'ca_1', object: 'application' } },
        },
        ctx(null),
      ),
    ).toEqual({ kind: 'account', accountId: 'acct_test_1', flags: null, disconnected: true });
  });

  it('payout.* não muda saque (design § 16: o saque conclui no transfer)', () => {
    expect(
      planForEvent({ id: 'e', type: 'payout.paid', data: { object: { id: 'po_1' } } }, ctx(null)),
    ).toEqual({ kind: 'ignore', reason: 'unhandled_type' });
  });

  it('tipo desconhecido não gera operação', () => {
    expect(
      planForEvent(
        { id: 'e', type: 'customer.created', data: { object: { id: 'cus_1' } } },
        ctx(null),
      ),
    ).toEqual({ kind: 'ignore', reason: 'unhandled_type' });
  });
});

describe('accountFlags', () => {
  it('lê as flags e junta pendências atuais e vencidas', () => {
    expect(
      accountFlags({
        id: 'acct_1',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements: { currently_due: ['a', 'b'], past_due: ['b', 'c'] },
      }),
    ).toEqual({
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirementsDue: ['a', 'b', 'c'],
    });
  });
});

describe('ledgerToRpc', () => {
  it('converte para o formato do apply_payment_event', () => {
    const plan = planForEvent(
      intentEvent('payment_intent.succeeded'),
      ctx(bookingPayment, { charge: { last4: '4242', brand: 'visa' } }),
    );
    if (plan.kind !== 'payment') throw new Error('esperado payment');
    expect(ledgerToRpc(plan.ledger)[0]).toEqual({
      account: 'merchant',
      kind: 'service',
      amount_cents: 5850,
      business_id: 39,
      user_id: null,
      withdrawal_id: null,
      title: 'Corte Demo',
      subtitle: 'Cliente QA',
    });
  });
});

describe('appointmentRequestedMessage', () => {
  it('mesma copy do app, no fuso de São Paulo', () => {
    expect(appointmentRequestedMessage('Ana', 'Corte', '2026-11-09T13:00:00.000Z')).toBe(
      'Ana solicitou um agendamento para Corte no dia segunda-feira, 9 de novembro às 10:00.',
    );
  });
});
