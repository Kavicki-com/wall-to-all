import {
  canManage,
  canSubscribe,
  invoiceSubscriptionId,
  mapSubscriptionStatus,
  pickCurrent,
  subscriptionCard,
  subscriptionEventTarget,
  subscriptionRow,
  toInvoice,
  toSubscription,
  type StripeInvoiceShape,
  type StripeSubscriptionShape,
} from '../supabase/functions/_shared/subscriptionStatus.ts';

// 2026-12-03T12:00:00Z e 2027-01-03T12:00:00Z em segundos.
const CREATED = 1796299200;
const PERIOD_END = 1798977600;

function sub(overrides: Partial<StripeSubscriptionShape> = {}): StripeSubscriptionShape {
  return {
    id: 'sub_1',
    status: 'active',
    created: CREATED,
    cancel_at_period_end: false,
    customer: 'cus_1',
    metadata: { business_id: '39' },
    items: {
      data: [
        {
          current_period_end: PERIOD_END,
          price: { id: 'price_premium', unit_amount: 2990 },
        },
      ],
    },
    ...overrides,
  };
}

function invoice(overrides: Partial<StripeInvoiceShape> = {}): StripeInvoiceShape {
  return {
    id: 'in_1',
    status: 'paid',
    total: 2990,
    created: CREATED,
    parent: { subscription_details: { subscription: 'sub_1' } },
    ...overrides,
  };
}

describe('mapSubscriptionStatus', () => {
  it.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['paused', 'past_due'],
    ['incomplete', 'incomplete'],
    ['canceled', 'canceled'],
    ['incomplete_expired', 'canceled'],
  ])('%s -> %s', (stripe, app) => {
    expect(mapSubscriptionStatus(stripe)).toBe(app);
  });

  it('status desconhecido vira canceled (sem acesso por engano)', () => {
    expect(mapSubscriptionStatus('algo_novo')).toBe('canceled');
  });
});

describe('toSubscription', () => {
  it('monta a assinatura do app com o fim do período vindo do item', () => {
    const card = { id: 'pm_1', brand: 'visa' as const, last4: '4242' };
    expect(toSubscription(sub(), card)).toEqual({
      id: 'sub_1',
      planId: 'price_premium',
      priceCents: 2990,
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: '2027-01-03T12:00:00.000Z',
      card,
    });
  });

  it('usa current_period_end da assinatura quando a API antiga o traz', () => {
    const shape = sub({ current_period_end: CREATED });
    expect(toSubscription(shape, null).currentPeriodEnd).toBe('2026-12-03T12:00:00.000Z');
  });

  it('repassa cancel_at_period_end e o status mapeado', () => {
    const result = toSubscription(sub({ status: 'unpaid', cancel_at_period_end: true }), null);
    expect(result.status).toBe('past_due');
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.card).toBeNull();
  });
});

describe('subscriptionCard', () => {
  it('cartão do PaymentMethod default: id, bandeira e final', () => {
    const pm = {
      id: 'pm_1',
      billing_details: { name: 'Loja' },
      card: { brand: 'visa', display_brand: 'visa', last4: '4242', exp_month: 1, exp_year: 2030 },
    };
    expect(subscriptionCard(pm)).toEqual({ id: 'pm_1', brand: 'visa', last4: '4242' });
  });

  it('sem PaymentMethod ou bandeira desconhecida -> null', () => {
    expect(subscriptionCard(null)).toBeNull();
    const pm = {
      id: 'pm_2',
      billing_details: { name: null },
      card: { brand: 'discover', display_brand: 'discover', last4: '1117', exp_month: 1, exp_year: 2030 },
    };
    expect(subscriptionCard(pm)).toBeNull();
  });
});

describe('pickCurrent', () => {
  it('só considera assinaturas do negócio', () => {
    const other = sub({ id: 'sub_outro', metadata: { business_id: '40' } });
    expect(pickCurrent([other], 39)).toBeNull();
  });

  it('prefere a viva mais recente às encerradas', () => {
    const canceled = sub({ id: 'sub_old', status: 'canceled', created: CREATED + 100 });
    const live = sub({ id: 'sub_live', status: 'past_due', created: CREATED });
    expect(pickCurrent([canceled, live], 39)?.id).toBe('sub_live');
  });

  it('entre vivas, a mais recente', () => {
    const a = sub({ id: 'sub_a', status: 'incomplete', created: CREATED });
    const b = sub({ id: 'sub_b', status: 'active', created: CREATED + 10 });
    expect(pickCurrent([a, b], 39)?.id).toBe('sub_b');
  });

  it('sem viva, devolve a encerrada mais recente', () => {
    const a = sub({ id: 'sub_a', status: 'canceled', created: CREATED });
    const b = sub({ id: 'sub_b', status: 'incomplete_expired', created: CREATED + 10 });
    expect(pickCurrent([a, b], 39)?.id).toBe('sub_b');
  });

  it('lista vazia -> null', () => {
    expect(pickCurrent([], 39)).toBeNull();
  });
});

describe('canSubscribe e canManage', () => {
  it('assinar só sem assinatura, cancelada ou incompleta', () => {
    expect(canSubscribe(null)).toBe(true);
    expect(canSubscribe('canceled')).toBe(true);
    expect(canSubscribe('incomplete')).toBe(true);
    expect(canSubscribe('active')).toBe(false);
    expect(canSubscribe('past_due')).toBe(false);
  });

  it('gerenciar (cartão, cancelar, manter) só ativa ou em atraso', () => {
    expect(canManage('active')).toBe(true);
    expect(canManage('past_due')).toBe(true);
    expect(canManage('incomplete')).toBe(false);
    expect(canManage('canceled')).toBe(false);
    expect(canManage(null)).toBe(false);
  });
});

describe('toInvoice', () => {
  it('fatura paga', () => {
    expect(toInvoice(invoice())).toEqual({
      id: 'in_1',
      amountCents: 2990,
      status: 'paid',
      createdAt: '2026-12-03T12:00:00.000Z',
    });
  });

  it('aberta e incobrável aparecem como open', () => {
    expect(toInvoice(invoice({ status: 'open' }))?.status).toBe('open');
    expect(toInvoice(invoice({ status: 'uncollectible' }))?.status).toBe('open');
  });

  it('rascunho e anulada não aparecem', () => {
    expect(toInvoice(invoice({ status: 'draft' }))).toBeNull();
    expect(toInvoice(invoice({ status: 'void' }))).toBeNull();
  });
});

describe('invoiceSubscriptionId', () => {
  it('lê parent.subscription_details (API atual)', () => {
    expect(invoiceSubscriptionId(invoice())).toBe('sub_1');
  });

  it('cai no campo subscription da API antiga', () => {
    expect(invoiceSubscriptionId(invoice({ parent: null, subscription: 'sub_velha' }))).toBe(
      'sub_velha',
    );
  });

  it('fatura avulsa -> null', () => {
    expect(invoiceSubscriptionId(invoice({ parent: null }))).toBeNull();
  });
});

describe('subscriptionEventTarget', () => {
  it.each(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'])(
    '%s aponta para a própria assinatura',
    (type) => {
      expect(subscriptionEventTarget({ type, data: { object: { id: 'sub_9' } } })).toEqual({
        subscriptionId: 'sub_9',
      });
    },
  );

  it.each(['invoice.paid', 'invoice.payment_failed'])('%s aponta para a assinatura da fatura', (type) => {
    const object = invoice() as unknown as Record<string, unknown>;
    expect(subscriptionEventTarget({ type, data: { object } })).toEqual({ subscriptionId: 'sub_1' });
  });

  it('fatura avulsa e outros eventos -> null', () => {
    const object = invoice({ parent: null }) as unknown as Record<string, unknown>;
    expect(subscriptionEventTarget({ type: 'invoice.paid', data: { object } })).toBeNull();
    expect(
      subscriptionEventTarget({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } }),
    ).toBeNull();
  });
});

describe('subscriptionRow', () => {
  it('linha da tabela subscriptions', () => {
    expect(subscriptionRow(sub({ cancel_at_period_end: true }))).toEqual({
      business_id: 39,
      provider: 'stripe',
      provider_subscription_id: 'sub_1',
      provider_customer_id: 'cus_1',
      price_id: 'price_premium',
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: '2027-01-03T12:00:00.000Z',
    });
  });

  it('customer expandido vira o id', () => {
    const row = subscriptionRow(sub({ customer: { id: 'cus_exp' } }));
    expect(row?.provider_customer_id).toBe('cus_exp');
  });

  it('sem business_id válido no metadata -> null (não é assinatura do app)', () => {
    expect(subscriptionRow(sub({ metadata: {} }))).toBeNull();
    expect(subscriptionRow(sub({ metadata: { business_id: 'abc' } }))).toBeNull();
    expect(subscriptionRow(sub({ metadata: { business_id: '0' } }))).toBeNull();
  });
});
