import { MockBookingPaymentService } from '../lib/services/mock/mockBookingPaymentService';
import type { BookingPaymentInput } from '../lib/services/bookingTypes';

const PAID_CARD: BookingPaymentInput = {
  status: 'paid',
  method: 'card',
  amountCents: 6500,
  cardLast4: '4242',
  cardBrand: 'visa',
};

const ON_SITE_CASH: BookingPaymentInput = {
  status: 'pay_on_site',
  method: 'cash',
  amountCents: 6500,
  cardLast4: null,
  cardBrand: null,
};

describe('MockBookingPaymentService', () => {
  it('returns null when nothing was recorded', async () => {
    const service = new MockBookingPaymentService();
    await expect(service.getPayment(123)).resolves.toBeNull();
  });

  it('records a paid card payment with paidAt and returns defensive copies', async () => {
    const service = new MockBookingPaymentService();
    const recorded = await service.recordPayment(123, PAID_CARD);

    expect(recorded).toMatchObject({ appointmentId: 123, ...PAID_CARD });
    expect(recorded.paidAt).not.toBeNull();
    expect(new Date(recorded.paidAt as string).toISOString()).toBe(recorded.paidAt);

    const fetched = await service.getPayment(123);
    expect(fetched).toEqual(recorded);

    (fetched as { amountCents: number }).amountCents = 1;
    recorded.amountCents = 2;
    await expect(service.getPayment(123)).resolves.toMatchObject({ amountCents: 6500 });
  });

  it('records pay_on_site with null paidAt', async () => {
    const service = new MockBookingPaymentService();
    const recorded = await service.recordPayment(5, ON_SITE_CASH);
    expect(recorded.paidAt).toBeNull();
    expect(recorded.status).toBe('pay_on_site');
  });

  it('overwrites a previous record for the same appointment', async () => {
    const service = new MockBookingPaymentService();
    await service.recordPayment(9, ON_SITE_CASH);
    await service.recordPayment(9, PAID_CARD);
    await expect(service.getPayment(9)).resolves.toMatchObject({ status: 'paid', method: 'card' });
  });

  it('rejects non-positive amounts', async () => {
    const service = new MockBookingPaymentService();
    await expect(service.recordPayment(1, { ...PAID_CARD, amountCents: 0 })).rejects.toThrow();
    await expect(service.recordPayment(1, { ...PAID_CARD, amountCents: -10 })).rejects.toThrow();
    await expect(service.getPayment(1)).resolves.toBeNull();
  });

  it('rejects paid with cash', async () => {
    const service = new MockBookingPaymentService();
    await expect(
      service.recordPayment(1, { ...ON_SITE_CASH, status: 'paid' }),
    ).rejects.toThrow();
  });

  it('rejects paid card without last4', async () => {
    const service = new MockBookingPaymentService();
    await expect(service.recordPayment(1, { ...PAID_CARD, cardLast4: null })).rejects.toThrow();
  });

  it('resolves without timers when latencyMs is 0', async () => {
    jest.useFakeTimers();
    try {
      const service = new MockBookingPaymentService({ latencyMs: 0 });
      await expect(service.recordPayment(2, ON_SITE_CASH)).resolves.toMatchObject({
        appointmentId: 2,
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
