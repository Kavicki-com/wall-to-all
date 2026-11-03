/**
 * `StripeQiService` (F8, Task 16, implementação híbrida): saldo do QI vem do
 * ledger (RPCs) e o saque vai ao `wallet-withdraw`; o resto (código,
 * indicações, extrato, regras, cotação) delega ao `MockQiService`.
 */
import { StripeQiService } from '../lib/services/stripe/stripeQiService';
import { MockQiService } from '../lib/services/mock/mockQiService';

const mockInvoke = jest.fn();
const mockRpc = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

function service(businessId = jest.fn(async () => 39)) {
  const base = new MockQiService({ latencyMs: 0 });
  return { svc: new StripeQiService({ base, businessId }), base, businessId };
}

describe('StripeQiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: { status: 'paid' }, error: null });
  });

  it('getQiSummary(client): saldo do my_qi_balance_cents, resto do mock', async () => {
    mockRpc.mockResolvedValue({ data: 650, error: null });
    const { svc, base } = service();
    const mockSummary = await base.getQiSummary('client');

    const summary = await svc.getQiSummary('client');

    expect(mockRpc).toHaveBeenCalledWith('my_qi_balance_cents');
    expect(summary).toEqual({ ...mockSummary, balanceCents: 650 });
  });

  it('getQiSummary(merchant): merchant_balance_cents do negócio, conta merchant_qi', async () => {
    mockRpc.mockResolvedValue({ data: '1300', error: null });
    const { svc, businessId } = service();

    const summary = await svc.getQiSummary('merchant');

    expect(businessId).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('merchant_balance_cents', {
      p_business_id: 39,
      p_account: 'merchant_qi',
    });
    expect(summary.balanceCents).toBe(1300);
  });

  it('erro do RPC propaga (a tela mostra o estado de erro)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('rpc') });
    const { svc } = service();
    await expect(svc.getQiSummary('client')).rejects.toThrow('rpc');
  });

  it('delega código, indicações e regras ao mock', async () => {
    const { svc, base } = service();
    await expect(svc.getQiCode('client')).resolves.toBe(await base.getQiCode('client'));
    await expect(svc.getProgramRules()).resolves.toEqual(await base.getProgramRules());
    await expect(svc.listIndicacoes('merchant', 1)).resolves.toEqual(
      await base.listIndicacoes('merchant', 1),
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    ['client', 'qi_client'],
    ['merchant', 'qi_merchant'],
  ] as const)(
    'requestQiWithdraw(%s) chama o wallet-withdraw com source %s',
    async (side, source) => {
      const { svc } = service();

      await svc.requestQiWithdraw(side, 3000, 'pix_1', 'chk_abc');

      expect(mockInvoke).toHaveBeenCalledWith('wallet-withdraw', {
        method: 'POST',
        body: { source, amountCents: 3000, pixKeyId: 'pix_1', idempotencyKey: 'chk_abc' },
      });
    },
  );

  it('sem chave, gera uma chk_', async () => {
    const { svc } = service();
    await svc.requestQiWithdraw('client', 3000, 'pix_1');
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.idempotencyKey).toMatch(/^chk_/);
  });

  it('abaixo do mínimo: erro antes de chamar o servidor', async () => {
    const { svc } = service();
    await expect(svc.requestQiWithdraw('client', 2999, 'pix_1', 'chk_abc')).rejects.toThrow(
      /mínimo/,
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
