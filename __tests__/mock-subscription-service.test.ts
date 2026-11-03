import { MockSubscriptionService } from '../lib/services/mock/mockSubscriptionService';
import type { PaymentCard } from '../lib/services/types';

const now = () => new Date('2026-05-20T12:00:00.000Z');

const visa: PaymentCard = {
  id: 'card_visa_1',
  brand: 'visa',
  last4: '4242',
  holderName: 'X',
  expiry: '12/30',
  isDefault: true,
};

const master: PaymentCard = {
  id: 'card_mastercard_1',
  brand: 'mastercard',
  last4: '5454',
  holderName: 'X',
  expiry: '11/29',
  isDefault: false,
};

function make(options: ConstructorParameters<typeof MockSubscriptionService>[0] = {}) {
  return new MockSubscriptionService({ latencyMs: 0, now, ...options });
}

describe('MockSubscriptionService', () => {
  it('returns the single plan from the Figma offer', async () => {
    const plan = await make().getPlan();
    expect(plan).toMatchObject({
      name: 'Wall to All Premium',
      badge: 'PLANO ÚNICO',
      priceCents: 2990,
      interval: 'month',
    });
    expect(plan.features).toEqual([
      'Agendamentos ilimitados',
      'Dashboard completo com métricas',
      'Sistema de indicações (Quem Indica)',
      'Carteira financeira e saques via PIX',
      'Cadastro ilimitado de serviços',
      'Suporte prioritário ao lojista',
    ]);
  });

  it('starts without subscription and invoices by default', async () => {
    const service = make();
    expect(await service.getSubscription()).toBeNull();
    expect(await service.getInvoices()).toEqual([]);
  });

  it('subscribe charges the card and activates for one month', async () => {
    const service = make();
    const sub = await service.subscribe(visa);
    expect(sub).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: false,
      priceCents: 2990,
      card: { id: 'card_visa_1', brand: 'visa', last4: '4242' },
      currentPeriodEnd: '2026-06-20T12:00:00.000Z',
    });
    const invoices = await service.getInvoices();
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ status: 'paid', amountCents: 2990 });
    expect(await service.getSubscription()).toEqual(sub);
  });

  it('a declined card returns incomplete without throwing, and a new card replaces it', async () => {
    const service = make({ declineCardIds: ['card_visa_1'] });
    const declined = await service.subscribe(visa);
    expect(declined.status).toBe('incomplete');
    expect((await service.getInvoices())[0].status).toBe('open');

    const sub = await service.subscribe(master);
    expect(sub.status).toBe('active');
    expect(sub.card?.last4).toBe('5454');
    expect(sub.id).not.toBe(declined.id);
    const invoices = await service.getInvoices();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe('paid');
  });

  it('clamps the period end to the last day of a shorter month', async () => {
    const service = make({ now: () => new Date('2026-01-31T12:00:00.000Z') });
    const sub = await service.subscribe(visa);
    expect(sub.currentPeriodEnd).toBe('2026-02-28T12:00:00.000Z');
  });

  it('subscribe throws when already active', async () => {
    const service = make({ initial: 'active' });
    await expect(service.subscribe(master)).rejects.toThrow();
  });

  it('seeds an active subscription with four monthly paid invoices', async () => {
    const service = make({ initial: 'active' });
    const sub = await service.getSubscription();
    expect(sub).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: false,
      card: { last4: '4242' },
      currentPeriodEnd: '2026-06-14T12:00:00.000Z',
    });
    const invoices = await service.getInvoices();
    expect(invoices.map((i) => i.createdAt)).toEqual([
      '2026-05-14T12:00:00.000Z',
      '2026-04-14T12:00:00.000Z',
      '2026-03-14T12:00:00.000Z',
      '2026-02-14T12:00:00.000Z',
    ]);
    expect(invoices.every((i) => i.status === 'paid' && i.amountCents === 2990)).toBe(true);
  });

  it('seeds from the previous month when today is before day 14', async () => {
    const service = make({ initial: 'active', now: () => new Date('2026-05-10T12:00:00.000Z') });
    const sub = await service.getSubscription();
    expect(sub?.currentPeriodEnd).toBe('2026-05-14T12:00:00.000Z');
    expect((await service.getInvoices())[0].createdAt).toBe('2026-04-14T12:00:00.000Z');
  });

  it('past_due: a new approved card pays the open invoice and reactivates', async () => {
    const service = make({ initial: 'past_due' });
    expect((await service.getSubscription())?.status).toBe('past_due');
    expect((await service.getInvoices())[0].status).toBe('open');

    const sub = await service.updatePaymentCard(master);
    expect(sub.status).toBe('active');
    expect(sub.card?.last4).toBe('5454');
    expect((await service.getInvoices())[0].status).toBe('paid');
  });

  it('past_due: a declined new card keeps past_due but swaps the card', async () => {
    const service = make({ initial: 'past_due', declineCardIds: ['card_mastercard_1'] });
    const sub = await service.updatePaymentCard(master);
    expect(sub.status).toBe('past_due');
    expect(sub.card?.last4).toBe('5454');
    expect((await service.getInvoices())[0].status).toBe('open');
  });

  it('updatePaymentCard on active only swaps the card', async () => {
    const service = make({ initial: 'active' });
    const before = await service.getInvoices();
    const sub = await service.updatePaymentCard(master);
    expect(sub.status).toBe('active');
    expect(sub.card).toEqual({ id: 'card_mastercard_1', brand: 'mastercard', last4: '5454' });
    expect(await service.getInvoices()).toEqual(before);
  });

  it('cancel and resume toggle cancelAtPeriodEnd idempotently', async () => {
    const service = make({ initial: 'active' });
    const canceled = await service.cancel();
    expect(canceled).toMatchObject({ status: 'active', cancelAtPeriodEnd: true });
    expect((await service.cancel()).cancelAtPeriodEnd).toBe(true);

    const resumed = await service.resume();
    expect(resumed).toMatchObject({ status: 'active', cancelAtPeriodEnd: false });
    expect((await service.resume()).cancelAtPeriodEnd).toBe(false);
  });

  it('seeds a canceling subscription', async () => {
    const sub = await make({ initial: 'canceling' }).getSubscription();
    expect(sub).toMatchObject({ status: 'active', cancelAtPeriodEnd: true });
  });

  it('cancel, resume and updatePaymentCard throw without subscription', async () => {
    const service = make();
    await expect(service.cancel()).rejects.toThrow();
    await expect(service.resume()).rejects.toThrow();
    await expect(service.updatePaymentCard(visa)).rejects.toThrow();
  });

  it('returns defensive copies', async () => {
    const service = make({ initial: 'active' });
    const sub = await service.getSubscription();
    sub!.status = 'canceled';
    sub!.card!.last4 = '0000';
    const invoices = await service.getInvoices();
    invoices[0].status = 'open';
    invoices.pop();

    const fresh = await service.getSubscription();
    expect(fresh?.status).toBe('active');
    expect(fresh?.card?.last4).toBe('4242');
    const freshInvoices = await service.getInvoices();
    expect(freshInvoices).toHaveLength(4);
    expect(freshInvoices[0].status).toBe('paid');

    const plan = await service.getPlan();
    plan.features.push('x');
    expect((await service.getPlan()).features).toHaveLength(6);
  });
});
