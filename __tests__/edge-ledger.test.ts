import {
  entriesForSucceeded,
  entriesForRefund,
  entriesForWithdraw,
  type SettledPayment,
} from '../supabase/functions/_shared/ledger.ts';

const booking: SettledPayment = {
  id: 'pay_1',
  purpose: 'booking',
  fundsFlow: 'destination',
  amountCents: 6500,
  platformFeeCents: 650,
  merchantBusinessId: 42,
  serviceName: 'Corte de cabelo masc.',
  payerName: 'Carlos Silva',
};

const furaFila: SettledPayment = {
  id: 'pay_2',
  purpose: 'fura_fila',
  fundsFlow: 'platform',
  amountCents: 1500,
  platformFeeCents: 0,
  merchantBusinessId: null,
  serviceName: null,
  payerName: 'Ana Souza',
};

describe('ledger (edge _shared)', () => {
  describe('entriesForSucceeded', () => {
    it('booking destination credita o líquido ao lojista e a taxa à plataforma', () => {
      expect(entriesForSucceeded(booking, {})).toEqual([
        {
          account: 'merchant',
          kind: 'service',
          amountCents: 5850,
          businessId: 42,
          userId: null,
          paymentId: 'pay_1',
          withdrawalId: null,
          title: 'Corte de cabelo masc.',
          subtitle: 'Carlos Silva',
        },
        {
          account: 'platform',
          kind: 'platform_fee',
          amountCents: 650,
          businessId: null,
          userId: null,
          paymentId: 'pay_1',
          withdrawalId: null,
          title: 'Taxa da plataforma',
          subtitle: 'Corte de cabelo masc.',
        },
      ]);
    });

    it('booking na plataforma (fallback Pix) lança igual no ledger', () => {
      const entries = entriesForSucceeded({ ...booking, fundsFlow: 'platform' }, {});
      expect(entries.map((e) => [e.account, e.kind, e.amountCents])).toEqual([
        ['merchant', 'service', 5850],
        ['platform', 'platform_fee', 650],
      ]);
    });

    it('sem taxa não gera lançamento zerado para a plataforma', () => {
      const entries = entriesForSucceeded({ ...booking, platformFeeCents: 0 }, {});
      expect(entries.map((e) => [e.account, e.kind, e.amountCents])).toEqual([
        ['merchant', 'service', 6500],
      ]);
    });

    it('fura-fila com negócio demo credita o lojista demo com a copy do mock', () => {
      const entries = entriesForSucceeded(
        { ...furaFila, platformFeeCents: 300 },
        { demoBusinessId: 7 },
      );
      expect(entries).toEqual([
        expect.objectContaining({
          account: 'merchant',
          kind: 'fura_fila',
          amountCents: 1200,
          businessId: 7,
          title: 'Furou Fila',
          subtitle: 'Taxa de antecipação Fura Fila',
        }),
        expect.objectContaining({ account: 'platform', kind: 'platform_fee', amountCents: 300 }),
      ]);
    });

    it('fura-fila sem negócio demo fica todo na plataforma', () => {
      expect(entriesForSucceeded(furaFila, {})).toEqual([
        expect.objectContaining({
          account: 'platform',
          kind: 'fura_fila',
          amountCents: 1500,
          businessId: null,
          title: 'Furou Fila',
        }),
      ]);
    });

    it('booking sem negócio é erro de dados', () => {
      expect(() => entriesForSucceeded({ ...booking, merchantBusinessId: null }, {})).toThrow();
    });

    it('taxa maior que o valor é erro', () => {
      expect(() => entriesForSucceeded({ ...booking, platformFeeCents: 7000 }, {})).toThrow();
    });
  });

  describe('entriesForRefund', () => {
    it('espelha os lançamentos do pagamento com sinal invertido', () => {
      const original = entriesForSucceeded(booking, {});
      const refund = entriesForRefund(booking, {});
      expect(refund).toHaveLength(original.length);
      refund.forEach((entry, i) => {
        expect(entry.account).toBe(original[i].account);
        expect(entry.businessId).toBe(original[i].businessId);
        expect(entry.amountCents).toBe(-original[i].amountCents);
        expect(entry.kind).toBe('refund');
        expect(entry.paymentId).toBe('pay_1');
        expect(entry.title).toBe('Estorno');
        expect(entry.subtitle).toBe(original[i].title);
      });
    });
  });

  describe('entriesForWithdraw', () => {
    it('saque do Financeiro debita o valor do lojista e credita a taxa à plataforma', () => {
      expect(
        entriesForWithdraw({
          id: 'wd_1',
          source: 'financeiro',
          amountCents: 10000,
          feeCents: 500,
          businessId: 42,
          userId: 'u-merchant',
          destinationLabel: '***.***.789-12',
        }),
      ).toEqual([
        {
          account: 'merchant',
          kind: 'withdraw',
          amountCents: -10000,
          businessId: 42,
          userId: null,
          paymentId: null,
          withdrawalId: 'wd_1',
          title: 'Saque',
          subtitle: '***.***.789-12',
        },
        {
          account: 'platform',
          kind: 'withdraw_fee',
          amountCents: 500,
          businessId: null,
          userId: null,
          paymentId: null,
          withdrawalId: 'wd_1',
          title: 'Taxa de saque',
          subtitle: 'Saque',
        },
      ]);
    });

    it('saque isento não gera lançamento de taxa', () => {
      const entries = entriesForWithdraw({
        id: 'wd_2',
        source: 'financeiro',
        amountCents: 20000,
        feeCents: 0,
        businessId: 42,
        userId: 'u-merchant',
        destinationLabel: 'chave',
      });
      expect(entries.map((e) => e.account)).toEqual(['merchant']);
    });

    it('saque QI do lojista debita a conta merchant_qi', () => {
      const [debit] = entriesForWithdraw({
        id: 'wd_3',
        source: 'qi_merchant',
        amountCents: 3000,
        feeCents: 500,
        businessId: 42,
        userId: 'u-merchant',
        destinationLabel: 'chave',
      });
      expect(debit).toEqual(
        expect.objectContaining({
          account: 'merchant_qi',
          kind: 'qi_withdraw',
          amountCents: -3000,
          businessId: 42,
        }),
      );
    });

    it('saque QI do cliente debita a conta client_qi do usuário', () => {
      const [debit] = entriesForWithdraw({
        id: 'wd_4',
        source: 'qi_client',
        amountCents: 3000,
        feeCents: 500,
        businessId: null,
        userId: 'u-client',
        destinationLabel: 'chave',
      });
      expect(debit).toEqual(
        expect.objectContaining({
          account: 'client_qi',
          kind: 'qi_withdraw',
          amountCents: -3000,
          businessId: null,
          userId: 'u-client',
        }),
      );
    });

    it('saque de lojista sem negócio é erro de dados', () => {
      expect(() =>
        entriesForWithdraw({
          id: 'wd_5',
          source: 'financeiro',
          amountCents: 3000,
          feeCents: 500,
          businessId: null,
          userId: 'u',
          destinationLabel: 'chave',
        }),
      ).toThrow();
    });
  });
});
