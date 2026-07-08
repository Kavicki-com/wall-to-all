import { MockQueueService } from '../lib/services/mock/mockQueueService';
import type { QueueTicket } from '../lib/services/types';

describe('MockQueueService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns nearby merchants with queue info', async () => {
    const svc = new MockQueueService();
    const merchants = await svc.getNearbyMerchants({ latitude: -23.5, longitude: -46.6 });
    expect(merchants.length).toBeGreaterThan(0);
    expect(merchants[0].queue.status).toBeDefined();
  });

  it('joinQueue returns ticket and getMyTicket finds it', async () => {
    const svc = new MockQueueService();
    const ticket = await svc.joinQueue('m1');
    expect(ticket.status).toBe('waiting');
    expect(await svc.getMyTicket()).toEqual(ticket);
  });

  it('fura-fila ticket enters ahead of regular tickets', async () => {
    const svc = new MockQueueService();
    const ticket = await svc.joinQueue('m1', { furaFila: true });
    expect(ticket.isFuraFila).toBe(true);
    expect(ticket.positionInLine).toBeLessThanOrEqual(1);
  });

  it('simulates queue advancing over time via subscribeToTicket', async () => {
    const svc = new MockQueueService({ tickIntervalMs: 1000 });
    const ticket = await svc.joinQueue('m1');
    const updates: number[] = [];
    svc.subscribeToTicket(ticket.id, (t) => updates.push(t.positionInLine));
    jest.advanceTimersByTime(3000);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[updates.length - 1]).toBeLessThan(ticket.positionInLine);
  });

  it('merchant can call next and resolve tickets', async () => {
    const svc = new MockQueueService();
    await svc.setQueueStatus('active');
    const next = await svc.callNext();
    expect(next?.status).toBe('called');
    await svc.resolveTicket(next!.id, 'served');
    const queue = await svc.getMerchantQueue();
    expect(queue.find((t) => t.id === next!.id)).toBeUndefined();
  });

  // ── Testes adicionais (além dos cinco do plano) ────────────────────────────

  it('does not emit immediately on subscribe (initial snapshot comes from getters)', async () => {
    const svc = new MockQueueService();
    const ticket = await svc.joinQueue('m1');
    const ticketCb = jest.fn();
    const queueCb = jest.fn();
    svc.subscribeToTicket(ticket.id, ticketCb);
    svc.subscribeToMerchantQueue(queueCb);
    expect(ticketCb).not.toHaveBeenCalled();
    expect(queueCb).not.toHaveBeenCalled();
  });

  it('unsubscribe stops ticket notifications', async () => {
    const svc = new MockQueueService({ tickIntervalMs: 1000 });
    const ticket = await svc.joinQueue('m1');
    const cb = jest.fn();
    const unsubscribe = svc.subscribeToTicket(ticket.id, cb);
    jest.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    jest.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('subscribeToMerchantQueue emits on queue changes and unsubscribe stops emissions', async () => {
    const svc = new MockQueueService();
    const snapshots: QueueTicket[][] = [];
    const unsubscribe = svc.subscribeToMerchantQueue((tickets) => snapshots.push(tickets));
    await svc.joinQueue('m1');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toHaveLength(6); // 5 tickets das fixtures + o novo
    unsubscribe();
    await svc.joinQueue('m1');
    expect(snapshots).toHaveLength(1);
  });

  it('dispose clears the tick interval', async () => {
    const svc = new MockQueueService({ tickIntervalMs: 1000 });
    const ticket = await svc.joinQueue('m1');
    const cb = jest.fn();
    svc.subscribeToTicket(ticket.id, cb);
    svc.dispose();
    jest.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('updateSettings merges partial, skips undefined keys, and returns full settings', async () => {
    const svc = new MockQueueService();
    const before = await svc.getSettings();
    const after = await svc.updateSettings({ maxSize: undefined, furaFilaPriceCents: 2000 });
    expect(after.furaFilaPriceCents).toBe(2000);
    expect(after.maxSize).toBe(before.maxSize);
    expect(after.furaFilaEnabled).toBe(before.furaFilaEnabled);
    expect(after.avgServiceMinutes).toBe(before.avgServiceMinutes);
    expect(await svc.getSettings()).toEqual(after);
  });

  it('leaveQueue removes the ticket and getMyTicket returns null', async () => {
    const svc = new MockQueueService();
    const ticket = await svc.joinQueue('m1');
    await svc.leaveQueue(ticket.id);
    expect(await svc.getMyTicket()).toBeNull();
    const queue = await svc.getMerchantQueue();
    expect(queue.find((t) => t.id === ticket.id)).toBeUndefined();
  });

  it('regular join enters at the end of the line', async () => {
    const svc = new MockQueueService();
    const queueBefore = await svc.getMerchantQueue();
    const ticket = await svc.joinQueue('m1');
    expect(ticket.positionInLine).toBe(queueBefore.length + 1);
  });

  it('getQueueInfo reflects live queue state for merchant m1', async () => {
    const svc = new MockQueueService();
    const before = await svc.getQueueInfo('m1');
    await svc.joinQueue('m1');
    const after = await svc.getQueueInfo('m1');
    expect(after.ticketsWaiting).toBe(before.ticketsWaiting + 1);
    expect(after.status).toBe('active');
    expect(after.settings).toEqual(await svc.getSettings());
  });

  it('paused queue does not advance on tick', async () => {
    const svc = new MockQueueService({ tickIntervalMs: 1000 });
    const ticket = await svc.joinQueue('m1');
    await svc.setQueueStatus('paused');
    const cb = jest.fn();
    svc.subscribeToTicket(ticket.id, cb);
    jest.advanceTimersByTime(3000);
    expect(cb).not.toHaveBeenCalled();
    expect((await svc.getMyTicket())?.positionInLine).toBe(ticket.positionInLine);
  });

  it('fixtures include merchant m1 and a Barbearia', async () => {
    const svc = new MockQueueService();
    const merchants = await svc.getNearbyMerchants({ latitude: -23.55, longitude: -46.63 });
    expect(merchants.some((m) => m.id === 'm1')).toBe(true);
    expect(merchants.some((m) => /Barbearia/.test(m.name))).toBe(true);
  });
});
