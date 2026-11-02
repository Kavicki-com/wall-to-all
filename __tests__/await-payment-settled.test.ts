import { awaitPaymentSettled } from '../lib/payments/awaitPaymentSettled';
import type { PaymentStatus } from '../lib/services/types';

function sequence(...statuses: PaymentStatus[]) {
  let i = 0;
  return jest.fn(async () => statuses[Math.min(i++, statuses.length - 1)]);
}

describe('awaitPaymentSettled', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('processing, processing, succeeded: succeeded em 3 consultas', async () => {
    const getStatus = sequence('processing', 'processing', 'succeeded');
    const done = awaitPaymentSettled(getStatus, { intervalMs: 2000, timeoutMs: 60000 });
    await jest.advanceTimersByTimeAsync(4000);
    await expect(done).resolves.toBe('succeeded');
    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  it('failed encerra na hora', async () => {
    const getStatus = sequence('failed');
    await expect(
      awaitPaymentSettled(getStatus, { intervalMs: 2000, timeoutMs: 60000 }),
    ).resolves.toBe('failed');
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it('canceled também é estado final', async () => {
    await expect(
      awaitPaymentSettled(sequence('canceled'), { intervalMs: 2000, timeoutMs: 60000 }),
    ).resolves.toBe('canceled');
  });

  it('sem mudança até o prazo: timeout', async () => {
    const getStatus = sequence('processing');
    const done = awaitPaymentSettled(getStatus, { intervalMs: 2000, timeoutMs: 10000 });
    await jest.advanceTimersByTimeAsync(12000);
    await expect(done).resolves.toBe('timeout');
  });

  it('signal abortado para o polling', async () => {
    const getStatus = sequence('processing');
    const controller = new AbortController();
    const done = awaitPaymentSettled(getStatus, {
      intervalMs: 2000,
      timeoutMs: 60000,
      signal: controller.signal,
    });
    await jest.advanceTimersByTimeAsync(2000);
    controller.abort();
    await expect(done).resolves.toBe('aborted');
    const calls = getStatus.mock.calls.length;
    await jest.advanceTimersByTimeAsync(10000);
    expect(getStatus).toHaveBeenCalledTimes(calls);
  });

  it('erro de rede numa consulta não derruba o polling', async () => {
    let n = 0;
    const getStatus = jest.fn(async (): Promise<PaymentStatus> => {
      n += 1;
      if (n === 1) throw new Error('rede');
      return 'succeeded';
    });
    const done = awaitPaymentSettled(getStatus, { intervalMs: 2000, timeoutMs: 60000 });
    await jest.advanceTimersByTimeAsync(2000);
    await expect(done).resolves.toBe('succeeded');
  });
});
