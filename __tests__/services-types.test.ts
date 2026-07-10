import type { QueueService, WalletService } from '../lib/services/types';

describe('service types', () => {
  it('are importable (type-only smoke test)', () => {
    const q: Partial<QueueService> = {};
    const w: Partial<WalletService> = {};
    expect(q).toBeDefined();
    expect(w).toBeDefined();
  });
});
