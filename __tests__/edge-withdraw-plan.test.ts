import {
  dbWithdrawError,
  parseWithdrawRequest,
  planWithdraw,
  withdrawalIdempotencyKey,
  type WithdrawInput,
} from '../supabase/functions/_shared/withdrawPlan.ts';
import { idempotencyKeys } from '../supabase/functions/_shared/idempotency.ts';
import { HttpError } from '../supabase/functions/_shared/http.ts';

const active = { payoutsEnabled: true, disconnected: false };

const base: WithdrawInput = {
  withdrawalId: '00000000-0000-0000-0000-0000000000w1',
  source: 'financeiro',
  amountCents: 10000,
  balanceCents: 50000,
  businessId: 39,
  userId: '00000000-0000-0000-0000-0000000000u1',
  destinationLabel: 'Pix ***.456.789-**',
  account: active,
};

describe('planWithdraw: Financeiro', () => {
  it('10000: taxa de 500, transfer do líquido e ledger -10000/+500', () => {
    const plan = planWithdraw(base);
    expect(plan).toMatchObject({
      ok: true,
      status: 'processing',
      transfer: true,
      quote: { amountCents: 10000, feeCents: 500, totalCents: 9500 },
    });
    if (!plan.ok) throw new Error('esperado ok');
    expect(plan.ledger).toEqual([
      expect.objectContaining({
        account: 'merchant',
        kind: 'withdraw',
        amountCents: -10000,
        businessId: 39,
        withdrawalId: base.withdrawalId,
      }),
      expect.objectContaining({ account: 'platform', kind: 'withdraw_fee', amountCents: 500 }),
    ]);
  });

  it('a partir de R$ 200,00 é isento', () => {
    const plan = planWithdraw({ ...base, amountCents: 20000 });
    if (!plan.ok) throw new Error('esperado ok');
    expect(plan.quote.totalCents).toBe(20000);
    expect(plan.ledger).toHaveLength(1);
  });

  it('valor que não cobre a taxa: below_minimum', () => {
    expect(planWithdraw({ ...base, amountCents: 500 })).toEqual({
      ok: false,
      code: 'below_minimum',
    });
  });

  it('saldo insuficiente', () => {
    expect(planWithdraw({ ...base, balanceCents: 9999 })).toEqual({
      ok: false,
      code: 'insufficient_balance',
    });
  });

  it('conta sem payouts_enabled, desconectada ou ausente: payout_account_inactive', () => {
    for (const account of [
      { payoutsEnabled: false, disconnected: false },
      { payoutsEnabled: true, disconnected: true },
      null,
    ]) {
      expect(planWithdraw({ ...base, account })).toEqual({
        ok: false,
        code: 'payout_account_inactive',
      });
    }
  });

  it('valor inválido: bad_request', () => {
    expect(planWithdraw({ ...base, amountCents: 10.5 })).toEqual({
      ok: false,
      code: 'bad_request',
    });
  });
});

describe('planWithdraw: QI', () => {
  it('QI lojista: transfer do líquido, débito em merchant_qi', () => {
    const plan = planWithdraw({ ...base, source: 'qi_merchant', amountCents: 5000 });
    if (!plan.ok) throw new Error('esperado ok');
    expect(plan.transfer).toBe(true);
    expect(plan.quote.totalCents).toBe(4500);
    expect(plan.ledger[0]).toMatchObject({ account: 'merchant_qi', kind: 'qi_withdraw' });
  });

  it('QI abaixo de R$ 30,00: below_minimum', () => {
    expect(planWithdraw({ ...base, source: 'qi_merchant', amountCents: 2999 })).toEqual({
      ok: false,
      code: 'below_minimum',
    });
  });

  it('QI cliente: manual_pending, sem transfer e sem exigir conta', () => {
    const plan = planWithdraw({
      ...base,
      source: 'qi_client',
      businessId: null,
      account: null,
      amountCents: 3000,
    });
    expect(plan).toMatchObject({ ok: true, status: 'manual_pending', transfer: false });
    if (!plan.ok) throw new Error('esperado ok');
    expect(plan.ledger[0]).toMatchObject({
      account: 'client_qi',
      kind: 'qi_withdraw',
      amountCents: -3000,
      userId: base.userId,
    });
  });
});

describe('parseWithdrawRequest', () => {
  const ok = {
    source: 'financeiro',
    amountCents: 10000,
    pixKeyId: 'pk-1',
    idempotencyKey: 'wd_abc123',
  };

  it('aceita o corpo válido', () => {
    expect(parseWithdrawRequest(ok)).toEqual(ok);
  });

  it('rejeita origem, chave Pix ou chave de idempotência inválidas', () => {
    for (const body of [
      { ...ok, source: 'banco' },
      { ...ok, pixKeyId: '' },
      { ...ok, idempotencyKey: 'x' },
      { ...ok, amountCents: '100' },
    ]) {
      expect(() => parseWithdrawRequest(body)).toThrow(HttpError);
    }
  });
});

describe('chaves', () => {
  it('idempotência do saque é por usuário', () => {
    expect(withdrawalIdempotencyKey('u1', 'wd_abc123')).toBe('withdraw:u1:wd_abc123');
  });

  it('transfer: uma chave por alocação', () => {
    expect(idempotencyKeys.transfer('w1', 7)).toBe('transfer:w1:7');
    expect(idempotencyKeys.transfer('w1')).toBe('transfer:w1');
  });
});

describe('dbWithdrawError', () => {
  it('traduz as exceções do begin_withdrawal', () => {
    expect(dbWithdrawError('insufficient_balance')).toBe('insufficient_balance');
    expect(dbWithdrawError('no_transfer_source')).toBe('invalid_state');
    expect(dbWithdrawError('idempotency_key_reused')).toBe('conflict');
    expect(dbWithdrawError('qualquer outra')).toBeNull();
  });
});
