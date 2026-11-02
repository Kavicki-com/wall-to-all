/**
 * StripeWalletService (F8, Task 11): a carteira real atrás da interface
 * `WalletService`. Supabase mockado (functions.invoke, from, rpc, auth) e SDK
 * da Stripe pelo mock oficial (`__mocks__/@stripe/stripe-react-native.js`).
 *
 * Regra central: `approved` só quando `payments.status = 'succeeded'` no banco,
 * nunca pela resposta da função.
 */
import { handleNextAction } from '@stripe/stripe-react-native';
import { StripeWalletService } from '../lib/services/stripe/stripeWalletService';
import { PaymentsApiError } from '../lib/services/stripe/edgeClient';
import type { PaymentRequestContext } from '../lib/services/types';

type Result = { data: unknown; error: unknown };

const mockInvoke = jest.fn();
const mockRpc = jest.fn();
const mockGetUser = jest.fn();
/** Resultados por tabela: cada leitura consome o próximo (o último se repete). */
const mockTableResults: Record<string, Result[]> = {};
/** Chamadas encadeadas por tabela: [método, ...args]. */
const mockTableCalls: Record<string, unknown[][]> = {};

jest.mock('../lib/supabase', () => {
  const next = (table: string): Result => {
    const queue = mockTableResults[table] ?? [];
    if (queue.length > 1) return queue.shift()!;
    return queue[0] ?? { data: null, error: null };
  };
  const buildQuery = (table: string) => {
    const calls: unknown[][] = (mockTableCalls[table] ??= []);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      };
    }
    for (const terminal of ['single', 'maybeSingle']) {
      builder[terminal] = () => Promise.resolve(next(table));
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(next(table)).then(resolve, reject);
    return builder;
  };
  return {
    supabase: {
      functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
      rpc: (...args: unknown[]) => mockRpc(...args),
      auth: { getUser: () => mockGetUser() },
      from: (table: string) => buildQuery(table),
    },
  };
});

const BOOKING: PaymentRequestContext = {
  purpose: { kind: 'booking', appointmentId: 77 },
  idempotencyKey: 'booking:77',
};

/** Erro HTTP como o supabase-js devolve (FunctionsHttpError com a Response). */
function httpError(status: number, code: string) {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: {
      status,
      json: () => Promise.resolve({ error: { code, message: code } }),
    },
  };
}

function setPaymentStatuses(...statuses: string[]) {
  mockTableResults.payments = statuses.map((status) => ({ data: { status }, error: null }));
}

function service() {
  return new StripeWalletService({ pollIntervalMs: 1, pollTimeoutMs: 1000 });
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockTableResults)) delete mockTableResults[key];
  for (const key of Object.keys(mockTableCalls)) delete mockTableCalls[key];
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

describe('StripeWalletService: cartões', () => {
  it('getCards lê payments-cards com GET', async () => {
    const cards = [
      { id: 'pm_1', brand: 'visa', last4: '4242', holderName: 'ANA', expiry: '12/30', isDefault: true },
    ];
    mockInvoke.mockResolvedValue({ data: cards, error: null });

    await expect(service().getCards()).resolves.toEqual(cards);
    expect(mockInvoke).toHaveBeenCalledWith('payments-cards', { method: 'GET' });
  });

  it('beginCardSetup e completeCardSetup usam as actions setup e complete', async () => {
    mockInvoke
      .mockResolvedValueOnce({ data: { setupIntentClientSecret: 'seti_1_secret_x' }, error: null })
      .mockResolvedValueOnce({
        data: { id: 'pm_2', brand: 'visa', last4: '4242', holderName: 'ANA', expiry: '12/30', isDefault: false },
        error: null,
      });
    const svc = service();

    await expect(svc.beginCardSetup()).resolves.toEqual({ setupIntentClientSecret: 'seti_1_secret_x' });
    await expect(svc.completeCardSetup('seti_1')).resolves.toMatchObject({ id: 'pm_2' });
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'payments-cards', {
      method: 'POST',
      body: { action: 'setup' },
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'payments-cards', {
      method: 'POST',
      body: { action: 'complete', setupIntentId: 'seti_1' },
    });
  });
});

describe('StripeWalletService: payWithCard', () => {
  it('aprova só depois que o banco diz succeeded', async () => {
    mockInvoke.mockResolvedValue({ data: { paymentId: 'pay-1', status: 'processing' }, error: null });
    setPaymentStatuses('processing', 'succeeded');

    await expect(service().payWithCard('pm_1', 6500, 'Corte', BOOKING)).resolves.toEqual({
      status: 'approved',
      paymentId: 'pay-1',
    });
    expect(mockInvoke).toHaveBeenCalledWith('payments-create-intent', {
      method: 'POST',
      body: {
        purpose: { kind: 'booking', appointmentId: 77 },
        method: 'card',
        cardId: 'pm_1',
        amountCents: 6500,
        idempotencyKey: 'booking:77',
      },
    });
    expect(mockTableCalls.payments).toContainEqual(['eq', 'id', 'pay-1']);
    expect(handleNextAction).not.toHaveBeenCalled();
  });

  it('resposta succeeded da função com banco ainda processing continua consultando', async () => {
    mockInvoke.mockResolvedValue({ data: { paymentId: 'pay-1', status: 'succeeded' }, error: null });
    setPaymentStatuses('processing', 'processing', 'succeeded');

    await expect(service().payWithCard('pm_1', 6500, 'Corte', BOOKING)).resolves.toEqual({
      status: 'approved',
      paymentId: 'pay-1',
    });
    const statusReads = mockTableCalls.payments.filter((c) => c[0] === 'select');
    expect(statusReads).toHaveLength(3);
  });

  it('requires_action roda o 3DS do SDK com o return URL do app', async () => {
    mockInvoke.mockResolvedValue({
      data: { paymentId: 'pay-1', status: 'requires_action', clientSecret: 'pi_1_secret_x' },
      error: null,
    });
    setPaymentStatuses('succeeded');
    (handleNextAction as jest.Mock).mockResolvedValueOnce({ paymentIntent: { status: 'Succeeded' } });

    await expect(service().payWithCard('pm_1', 6500, 'Corte', BOOKING)).resolves.toMatchObject({
      status: 'approved',
    });
    expect(handleNextAction).toHaveBeenCalledWith('pi_1_secret_x', 'walltoall://stripe-redirect');
  });

  it('erro no 3DS vira declined sem consultar o banco', async () => {
    mockInvoke.mockResolvedValue({
      data: { paymentId: 'pay-1', status: 'requires_action', clientSecret: 'pi_1_secret_x' },
      error: null,
    });
    (handleNextAction as jest.Mock).mockResolvedValueOnce({
      error: { code: 'Failed', message: 'auth failed' },
    });

    await expect(service().payWithCard('pm_1', 6500, 'Corte', BOOKING)).resolves.toEqual({
      status: 'declined',
      paymentId: 'pay-1',
    });
    expect(mockTableCalls.payments).toBeUndefined();
  });

  it('failed na resposta ou no banco vira declined', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { paymentId: 'pay-1', status: 'failed', failureCode: 'card_declined' },
      error: null,
    });
    await expect(service().payWithCard('pm_1', 6500, 'Corte', BOOKING)).resolves.toEqual({
      status: 'declined',
      paymentId: 'pay-1',
    });

    mockInvoke.mockResolvedValueOnce({ data: { paymentId: 'pay-2', status: 'processing' }, error: null });
    setPaymentStatuses('failed');
    await expect(service().payWithCard('pm_1', 6500, 'Corte', BOOKING)).resolves.toEqual({
      status: 'declined',
      paymentId: 'pay-2',
    });
  });

  it('sem estado final até o timeout lança erro pt-BR (retry com a mesma chave é seguro)', async () => {
    mockInvoke.mockResolvedValue({ data: { paymentId: 'pay-1', status: 'processing' }, error: null });
    setPaymentStatuses('processing');
    const svc = new StripeWalletService({ pollIntervalMs: 1, pollTimeoutMs: 5 });

    await expect(svc.payWithCard('pm_1', 6500, 'Corte', BOOKING)).rejects.toThrow(
      /ainda não confirmamos/i,
    );
  });

  it('sem context lança antes de chamar o servidor', async () => {
    await expect(service().payWithCard('pm_1', 6500, 'Corte')).rejects.toThrow(/finalidade/);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('StripeWalletService: Pix', () => {
  it('createPixCharge devolve o QR da Stripe com paymentId', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        paymentId: 'pay-9',
        status: 'requires_action',
        pix: {
          copyPasteCode: '00020126...',
          qrImageUrl: 'https://qr.stripe.com/x.png',
          hostedInstructionsUrl: 'https://payments.stripe.com/pix/x',
          expiresAt: '2026-11-02T12:15:00.000Z',
        },
      },
      error: null,
    });
    const ctx: PaymentRequestContext = {
      purpose: { kind: 'fura_fila', merchantRef: 'm1' },
      idempotencyKey: 'chk_abc12345',
    };

    await expect(service().createPixCharge(1500, 'Fura-fila', ctx)).resolves.toEqual({
      qrCode: '00020126...',
      copyPasteCode: '00020126...',
      qrImageUrl: 'https://qr.stripe.com/x.png',
      amountCents: 1500,
      expiresAt: '2026-11-02T12:15:00.000Z',
      paymentId: 'pay-9',
    });
    expect(mockInvoke).toHaveBeenCalledWith('payments-create-intent', {
      method: 'POST',
      body: {
        purpose: { kind: 'fura_fila', merchantRef: 'm1' },
        method: 'pix',
        amountCents: 1500,
        idempotencyKey: 'chk_abc12345',
      },
    });
  });

  it('createPixCharge sem context lança', async () => {
    await expect(service().createPixCharge(1500, 'x')).rejects.toThrow(/finalidade/);
  });

  it('getPaymentStatus lê payments.status', async () => {
    setPaymentStatuses('processing');
    await expect(service().getPaymentStatus('pay-9')).resolves.toBe('processing');
  });
});

describe('StripeWalletService: chaves Pix e extrato do cliente', () => {
  it('getPixKeys lê a view my_pix_keys', async () => {
    mockTableResults.my_pix_keys = [
      {
        data: [{ id: 'k1', type: 'cpf', masked_value: '*********-12', created_at: '2026-11-01T10:00:00Z' }],
        error: null,
      },
    ];
    await expect(service().getPixKeys()).resolves.toEqual([
      { id: 'k1', type: 'cpf', maskedValue: '*********-12', createdAt: '2026-11-01T10:00:00Z' },
    ]);
  });

  it('addPixKey chama o RPC add_pix_key e repassa a validação do banco', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { id: 'k2', type: 'email', masked_value: 'a***@x.com', created_at: '2026-11-02T10:00:00Z' },
      error: null,
    });
    await expect(service().addPixKey({ type: 'email', value: 'ana@x.com' })).resolves.toEqual({
      id: 'k2',
      type: 'email',
      maskedValue: 'a***@x.com',
      createdAt: '2026-11-02T10:00:00Z',
    });
    expect(mockRpc).toHaveBeenCalledWith('add_pix_key', { p_type: 'email', p_value: 'ana@x.com' });

    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'CPF inválido.' } });
    await expect(service().addPixKey({ type: 'cpf', value: '1' })).rejects.toThrow('CPF inválido.');
  });

  it('getStatement lista os pagamentos do próprio pagador como débitos', async () => {
    mockTableResults.payments = [
      {
        data: [
          {
            id: 'pay-1',
            purpose: 'booking',
            method: 'card',
            amount_cents: 6500,
            paid_at: '2026-11-02T10:00:00Z',
            created_at: '2026-11-02T09:59:00Z',
          },
          {
            id: 'pay-2',
            purpose: 'fura_fila',
            method: 'pix',
            amount_cents: 1500,
            paid_at: null,
            created_at: '2026-11-01T09:00:00Z',
          },
        ],
        error: null,
      },
    ];

    await expect(service().getStatement()).resolves.toEqual([
      { id: 'pay-1', kind: 'service', title: 'Agendamento', subtitle: 'Cartão', amountCents: -6500, date: '2026-11-02T10:00:00Z' },
      { id: 'pay-2', kind: 'fura_fila', title: 'Furou Fila', subtitle: 'Pix', amountCents: -1500, date: '2026-11-01T09:00:00Z' },
    ]);
    expect(mockTableCalls.payments).toContainEqual(['eq', 'payer_id', 'user-1']);
    expect(mockTableCalls.payments).toContainEqual(['eq', 'status', 'succeeded']);
  });
});

describe('StripeWalletService: lojista', () => {
  beforeEach(() => {
    mockTableResults.business_profiles = [{ data: { id: 39 }, error: null }];
  });

  it('getMerchantBalanceCents usa o RPC do negócio do usuário', async () => {
    mockRpc.mockResolvedValue({ data: 12345, error: null });
    await expect(service().getMerchantBalanceCents()).resolves.toBe(12345);
    expect(mockTableCalls.business_profiles).toContainEqual(['eq', 'owner_id', 'user-1']);
    expect(mockRpc).toHaveBeenCalledWith('merchant_balance_cents', {
      p_business_id: 39,
      p_account: 'merchant',
    });
  });

  it('getMerchantStatement mapeia o ledger do lojista', async () => {
    mockTableResults.ledger_entries = [
      {
        data: [
          { id: 3, kind: 'withdraw', amount_cents: -5000, title: 'Saque', subtitle: '*********-12', created_at: '2026-11-02T12:00:00Z', withdrawal_id: 'w1' },
          { id: 2, kind: 'fura_fila', amount_cents: 1500, title: 'Furou Fila', subtitle: 'Ana', created_at: '2026-11-02T11:00:00Z', withdrawal_id: null },
          { id: 1, kind: 'service', amount_cents: 6500, title: 'Corte', subtitle: 'Ana', created_at: '2026-11-02T10:00:00Z', withdrawal_id: null },
          { id: 4, kind: 'refund', amount_cents: 5000, title: 'Estorno', subtitle: 'Saque', created_at: '2026-11-02T12:01:00Z', withdrawal_id: 'w1' },
        ],
        error: null,
      },
    ];

    const entries = await service().getMerchantStatement();
    expect(entries.map((e) => [e.id, e.kind, e.amountCents])).toEqual([
      ['3', 'withdraw', -5000],
      ['2', 'fura_fila', 1500],
      ['1', 'service', 6500],
      ['4', 'withdraw', 5000],
    ]);
    expect(entries[0]).toEqual({
      id: '3',
      kind: 'withdraw',
      title: 'Saque',
      subtitle: '*********-12',
      amountCents: -5000,
      date: '2026-11-02T12:00:00Z',
    });
    expect(mockTableCalls.ledger_entries).toContainEqual(['eq', 'business_id', 39]);
    expect(mockTableCalls.ledger_entries).toContainEqual(['eq', 'account', 'merchant']);
  });

  it('requestWithdraw chama wallet-withdraw com source financeiro e a chave dada', async () => {
    mockInvoke.mockResolvedValue({ data: { withdrawalId: 'w1', status: 'paid' }, error: null });
    await service().requestWithdraw(5000, 'k1', 'wd_key_123456');
    expect(mockInvoke).toHaveBeenCalledWith('wallet-withdraw', {
      method: 'POST',
      body: { source: 'financeiro', amountCents: 5000, pixKeyId: 'k1', idempotencyKey: 'wd_key_123456' },
    });
  });

  it('requestWithdraw sem chave gera uma chk_', async () => {
    mockInvoke.mockResolvedValue({ data: { withdrawalId: 'w1', status: 'paid' }, error: null });
    await service().requestWithdraw(5000, 'k1');
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.idempotencyKey).toMatch(/^chk_/);
  });

  it.each([
    ['insufficient_balance', 422, /saldo insuficiente/i],
    ['payout_account_inactive', 409, /ative seus recebimentos/i],
    ['amount_mismatch', 409, /valor mudou/i],
  ])('erro %s vira mensagem pt-BR', async (code, status, message) => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(status, code) });
    const promise = service().requestWithdraw(5000, 'k1', 'wd_key_123456');
    await expect(promise).rejects.toThrow(message);
    await expect(promise).rejects.toBeInstanceOf(PaymentsApiError);
    await expect(promise).rejects.toMatchObject({ code, status });
  });

  it('quoteWithdraw usa a mesma régua do servidor, com o prazo do repasse', async () => {
    await expect(service().quoteWithdraw(5000)).resolves.toMatchObject({
      amountCents: 5000,
      feeCents: 500,
      totalCents: 4500,
    });
    const quote = await service().quoteWithdraw(20000);
    expect(quote.feeCents).toBe(0);
    expect(quote.etaLabel).not.toBe('Até 24 horas');
  });

  it('getPayoutAccountStatus e startPayoutOnboarding usam connect-onboarding', async () => {
    mockInvoke
      .mockResolvedValueOnce({ data: { status: 'pending', chargesEnabled: false, payoutsEnabled: false, requirementsDue: [] }, error: null })
      .mockResolvedValueOnce({ data: { url: 'https://connect.stripe.com/setup/x' }, error: null });
    const svc = service();

    await expect(svc.getPayoutAccountStatus()).resolves.toBe('pending');
    await expect(svc.startPayoutOnboarding()).resolves.toEqual({ url: 'https://connect.stripe.com/setup/x' });
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'connect-onboarding', { method: 'GET' });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'connect-onboarding', {
      method: 'POST',
      body: { action: 'link' },
    });
  });
});
