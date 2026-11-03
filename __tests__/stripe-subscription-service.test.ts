/**
 * `StripeSubscriptionService` (F8, Task 17): fala com a Edge Function
 * `subscriptions` e conclui o 3DS da fatura no SDK quando o banco pede.
 */
import { handleNextAction } from '@stripe/stripe-react-native';
import { StripeSubscriptionService } from '../lib/services/stripe/stripeSubscriptionService';
import { PaymentsApiError } from '../lib/services/stripe/edgeClient';
import type { PaymentCard } from '../lib/services/types';
import type { Subscription } from '../lib/services/subscriptionTypes';

const mockInvoke = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

jest.mock('@stripe/stripe-react-native', () => ({ handleNextAction: jest.fn() }));
const mockedHandleNextAction = handleNextAction as jest.MockedFunction<typeof handleNextAction>;

const CARD: PaymentCard = {
  id: 'pm_visa',
  brand: 'visa',
  last4: '4242',
  expiry: '12/30',
  holderName: 'LOJA',
  isDefault: true,
};

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_1',
    planId: 'price_premium',
    priceCents: 2990,
    status: 'active',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: '2026-12-03T14:33:11.000Z',
    card: { id: 'pm_visa', brand: 'visa', last4: '4242' },
    ...overrides,
  };
}

function ok(data: unknown) {
  return Promise.resolve({ data, error: null });
}

function service() {
  return new StripeSubscriptionService({ pollIntervalMs: 0, pollTimeoutMs: 50 });
}

describe('StripeSubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getPlan: texto do plano com o preço do Price da Stripe', async () => {
    mockInvoke.mockReturnValue(ok({ priceCents: 3490, subscription: null }));

    const plan = await service().getPlan();

    expect(mockInvoke).toHaveBeenCalledWith('subscriptions', { method: 'GET' });
    expect(plan.priceCents).toBe(3490);
    expect(plan.name).toBe('Wall to All Premium');
    expect(plan.interval).toBe('month');
    expect(plan.features).toHaveLength(6);
  });

  it('getSubscription: assinatura atual ou null', async () => {
    mockInvoke.mockReturnValueOnce(ok({ priceCents: 2990, subscription: null }));
    expect(await service().getSubscription()).toBeNull();

    mockInvoke.mockReturnValueOnce(ok({ priceCents: 2990, subscription: subscription() }));
    expect(await service().getSubscription()).toEqual(subscription());
  });

  it('subscribe: manda só o id do cartão e devolve o resultado da 1ª cobrança', async () => {
    mockInvoke.mockReturnValue(ok({ subscription: subscription(), clientSecret: null }));

    const result = await service().subscribe(CARD);

    expect(mockInvoke).toHaveBeenCalledWith('subscriptions', {
      method: 'POST',
      body: { action: 'subscribe', paymentMethodId: 'pm_visa' },
    });
    expect(result.status).toBe('active');
    expect(mockedHandleNextAction).not.toHaveBeenCalled();
  });

  it('subscribe recusado: devolve incomplete sem lançar', async () => {
    mockInvoke.mockReturnValue(
      ok({ subscription: subscription({ status: 'incomplete' }), clientSecret: null }),
    );
    await expect(service().subscribe(CARD)).resolves.toMatchObject({ status: 'incomplete' });
  });

  it('subscribe com 3DS: autentica no SDK e espera a assinatura sair de incomplete', async () => {
    mockInvoke
      .mockReturnValueOnce(
        ok({ subscription: subscription({ status: 'incomplete' }), clientSecret: 'pi_secret' }),
      )
      .mockReturnValueOnce(ok({ priceCents: 2990, subscription: subscription({ status: 'incomplete' }) }))
      .mockReturnValueOnce(ok({ priceCents: 2990, subscription: subscription({ status: 'active' }) }));
    mockedHandleNextAction.mockResolvedValue({} as Awaited<ReturnType<typeof handleNextAction>>);

    const result = await service().subscribe(CARD);

    expect(mockedHandleNextAction).toHaveBeenCalledWith('pi_secret', 'walltoall://stripe-redirect');
    expect(result.status).toBe('active');
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it('subscribe com 3DS recusado ou abandonado: fica incomplete, sem consultar de novo', async () => {
    mockInvoke.mockReturnValueOnce(
      ok({ subscription: subscription({ status: 'incomplete' }), clientSecret: 'pi_secret' }),
    );
    mockedHandleNextAction.mockResolvedValue({
      error: { code: 'Canceled', message: 'cancelado' },
    } as unknown as Awaited<ReturnType<typeof handleNextAction>>);

    const result = await service().subscribe(CARD);

    expect(result.status).toBe('incomplete');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('3DS aprovado mas o servidor demora: devolve o último estado ao fim da espera', async () => {
    mockInvoke
      .mockReturnValueOnce(
        ok({ subscription: subscription({ status: 'incomplete' }), clientSecret: 'pi_secret' }),
      )
      .mockReturnValue(ok({ priceCents: 2990, subscription: subscription({ status: 'incomplete' }) }));
    mockedHandleNextAction.mockResolvedValue({} as Awaited<ReturnType<typeof handleNextAction>>);

    const result = await service().subscribe(CARD);

    expect(result.status).toBe('incomplete');
  });

  it('updatePaymentCard: troca o cartão; em atraso com 3DS espera sair de past_due', async () => {
    mockInvoke
      .mockReturnValueOnce(
        ok({ subscription: subscription({ status: 'past_due' }), clientSecret: 'pi_secret' }),
      )
      .mockReturnValueOnce(ok({ priceCents: 2990, subscription: subscription({ status: 'active' }) }));
    mockedHandleNextAction.mockResolvedValue({} as Awaited<ReturnType<typeof handleNextAction>>);

    const result = await service().updatePaymentCard(CARD);

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'subscriptions', {
      method: 'POST',
      body: { action: 'update_card', paymentMethodId: 'pm_visa' },
    });
    expect(result.status).toBe('active');
  });

  it('cancel e resume: ligam e desligam o cancelamento no fim do período', async () => {
    mockInvoke.mockReturnValueOnce(
      ok({ subscription: subscription({ cancelAtPeriodEnd: true }), clientSecret: null }),
    );
    const canceled = await service().cancel();
    expect(mockInvoke).toHaveBeenLastCalledWith('subscriptions', {
      method: 'POST',
      body: { action: 'cancel' },
    });
    expect(canceled.cancelAtPeriodEnd).toBe(true);

    mockInvoke.mockReturnValueOnce(ok({ subscription: subscription(), clientSecret: null }));
    const resumed = await service().resume();
    expect(mockInvoke).toHaveBeenLastCalledWith('subscriptions', {
      method: 'POST',
      body: { action: 'resume' },
    });
    expect(resumed.cancelAtPeriodEnd).toBe(false);
  });

  it('getInvoices: lista do servidor', async () => {
    const invoices = [
      { id: 'in_2', amountCents: 2990, status: 'open', createdAt: '2026-12-03T14:33:11.000Z' },
      { id: 'in_1', amountCents: 2990, status: 'paid', createdAt: '2026-11-03T14:33:11.000Z' },
    ];
    mockInvoke.mockReturnValue(ok(invoices));

    await expect(service().getInvoices()).resolves.toEqual(invoices);
    expect(mockInvoke).toHaveBeenCalledWith('subscriptions', {
      method: 'POST',
      body: { action: 'invoices' },
    });
  });

  it('erro da função vira PaymentsApiError (a tela mostra a mensagem)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: { status: 409, json: async () => ({ error: { code: 'invalid_state' } }) },
      },
    });

    const error = await service().cancel().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PaymentsApiError);
    expect((error as PaymentsApiError).code).toBe('invalid_state');
  });
});
