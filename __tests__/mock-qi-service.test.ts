import { MockQiService } from '../lib/services/mock/mockQiService';
import { computeWithdrawQuote } from '../lib/services/mock/withdrawQuote';

describe('computeWithdrawQuote', () => {
  it('applies the R$ 5,00 fee below the fee-free threshold', () => {
    expect(computeWithdrawQuote(10000)).toEqual({
      amountCents: 10000,
      feeCents: 500,
      totalCents: 9500,
      etaLabel: 'Até 24 horas',
    });
  });

  it('waives the fee at the R$ 200,00 threshold', () => {
    expect(computeWithdrawQuote(20000)).toEqual({
      amountCents: 20000,
      feeCents: 0,
      totalCents: 20000,
      etaLabel: 'Até 24 horas',
    });
  });

  it('throws for a non-positive or non-integer amount', () => {
    expect(() => computeWithdrawQuote(0)).toThrow();
    expect(() => computeWithdrawQuote(-100)).toThrow();
    expect(() => computeWithdrawQuote(10.5)).toThrow();
  });
});

describe('MockQiService', () => {
  describe('getQiSummary', () => {
    it('returns the client summary mirroring the Figma hero', async () => {
      const svc = new MockQiService();
      const summary = await svc.getQiSummary('client');
      expect(summary.balanceCents).toBe(7409);
      expect(summary.totalEarnedCents).toBe(4500);
      expect(summary.indicadosCount).toBe(12);
      expect(summary.bonusCount).toBe(8);
      expect(summary.nextLevel).toEqual({ name: 'Ouro', target: 30 });
    });

    it('returns the merchant summary mirroring the Figma hero', async () => {
      const svc = new MockQiService();
      const summary = await svc.getQiSummary('merchant');
      expect(summary.balanceCents).toBe(8909);
      expect(summary.totalEarnedCents).toBe(4500);
      expect(summary.indicadosCount).toBe(6);
      expect(summary.bonusCount).toBe(8);
      expect(summary.nextLevel).toEqual({ name: 'Ouro', target: 30 });
    });

    it('returns defensive copies (mutation does not leak)', async () => {
      const svc = new MockQiService();
      const first = await svc.getQiSummary('client');
      first.balanceCents = 0;
      first.nextLevel!.target = 999;
      const second = await svc.getQiSummary('client');
      expect(second.balanceCents).toBe(7409);
      expect(second.nextLevel).toEqual({ name: 'Ouro', target: 30 });
    });
  });

  describe('getQiCode', () => {
    it('returns the same fixture code on both sides', async () => {
      const svc = new MockQiService();
      await expect(svc.getQiCode('client')).resolves.toBe('QI-HOG23-3892');
      await expect(svc.getQiCode('merchant')).resolves.toBe('QI-HOG23-3892');
    });
  });

  describe('listIndicacoes', () => {
    it('client: page 1 has 5 of 3 pages, starting with Lucas Almeida', async () => {
      const svc = new MockQiService();
      const page = await svc.listIndicacoes('client', 1);
      expect(page.items).toHaveLength(5);
      expect(page.page).toBe(1);
      expect(page.totalPages).toBe(3);
      expect(page.items[0]).toMatchObject({
        id: 'qi-c-01',
        name: 'Lucas Almeida',
        earnedCents: 1050,
      });
    });

    it('client: last page has the remaining 2 items', async () => {
      const svc = new MockQiService();
      const page = await svc.listIndicacoes('client', 3);
      expect(page.items).toHaveLength(2);
      expect(page.totalPages).toBe(3);
    });

    it('merchant: 6 indicadas over 2 pages, starting with Hortti Frutti - Oba', async () => {
      const svc = new MockQiService();
      const page1 = await svc.listIndicacoes('merchant', 1);
      expect(page1.items).toHaveLength(5);
      expect(page1.totalPages).toBe(2);
      expect(page1.items[0]).toMatchObject({ name: 'Hortti Frutti - Oba', earnedCents: 1050 });
      const page2 = await svc.listIndicacoes('merchant', 2);
      expect(page2.items).toHaveLength(1);
    });

    it('every fixture indicacao has avatarUrl null (screens fall back to initials)', async () => {
      const svc = new MockQiService();
      const all = [
        ...(await svc.listIndicacoes('client', 1)).items,
        ...(await svc.listIndicacoes('client', 2)).items,
        ...(await svc.listIndicacoes('client', 3)).items,
        ...(await svc.listIndicacoes('merchant', 1)).items,
        ...(await svc.listIndicacoes('merchant', 2)).items,
      ];
      expect(all).toHaveLength(18);
      expect(all.every((i) => i.avatarUrl === null)).toBe(true);
    });

    it('rejects a page out of range', async () => {
      const svc = new MockQiService();
      await expect(svc.listIndicacoes('client', 0)).rejects.toThrow();
      await expect(svc.listIndicacoes('client', 4)).rejects.toThrow();
      await expect(svc.listIndicacoes('merchant', 3)).rejects.toThrow();
    });

    it('returns defensive copies (mutation does not leak)', async () => {
      const svc = new MockQiService();
      const page = await svc.listIndicacoes('client', 1);
      page.items[0].name = 'HACKED';
      const again = await svc.listIndicacoes('client', 1);
      expect(again.items[0].name).toBe('Lucas Almeida');
    });
  });

  describe('getIndicacao / getIndicacaoStatement', () => {
    it('returns the Lucas Almeida details mirroring the Figma detail screen', async () => {
      const svc = new MockQiService();
      const lucas = await svc.getIndicacao('client', 'qi-c-01');
      expect(lucas.name).toBe('Lucas Almeida');
      expect(lucas.earnedCents).toBe(1050);
      expect(lucas.status).toBe('active');
      expect(lucas.appointmentsCount).toBe(6);
      expect(lucas.indicatedAt).toBe('2026-02-12T12:00:00.000Z');
      expect(lucas.firstAppointmentAt).toBe('2026-02-15T12:00:00.000Z');
      expect(lucas.avatarUrl).toBeNull();
    });

    it('returns the 4 fixture statement entries of R$ 2,65 for Lucas Almeida', async () => {
      const svc = new MockQiService();
      const entries = await svc.getIndicacaoStatement('client', 'qi-c-01');
      expect(entries).toHaveLength(4);
      expect(entries.every((e) => e.title === 'Agendamento realizado')).toBe(true);
      expect(entries.every((e) => e.amountCents === 265)).toBe(true);
      expect(entries.map((e) => e.subtitle)).toEqual([
        'Carlos Silva',
        'Anderson Ribeiro',
        'Carlos Silva',
        'Silvio Santos',
      ]);
    });

    it('rejects an unknown indicacao id', async () => {
      const svc = new MockQiService();
      await expect(svc.getIndicacao('client', 'qi-x-99')).rejects.toThrow();
      await expect(svc.getIndicacaoStatement('client', 'qi-x-99')).rejects.toThrow();
    });

    it('statement entries are defensive copies (mutation does not leak)', async () => {
      const svc = new MockQiService();
      const entries = await svc.getIndicacaoStatement('client', 'qi-c-01');
      entries[0].amountCents = 999999;
      const again = await svc.getIndicacaoStatement('client', 'qi-c-01');
      expect(again[0].amountCents).toBe(265);
    });
  });

  describe('getProgramRules', () => {
    it('exposes the program rules', async () => {
      const svc = new MockQiService();
      await expect(svc.getProgramRules()).resolves.toEqual({
        perServicePct: 10,
        monthlyBonusCents: 500,
        topLevelMultiplier: 2,
        minWithdrawCents: 3000,
        feeCents: 500,
        feeFreeThresholdCents: 20000,
        creditWindowHours: 24,
      });
    });
  });

  describe('quoteWithdraw', () => {
    it('charges the fee below the threshold and waives it from R$ 200,00', async () => {
      const svc = new MockQiService();
      await expect(svc.quoteWithdraw(10000)).resolves.toEqual({
        amountCents: 10000,
        feeCents: 500,
        totalCents: 9500,
        etaLabel: 'Até 24 horas',
      });
      await expect(svc.quoteWithdraw(20000)).resolves.toEqual({
        amountCents: 20000,
        feeCents: 0,
        totalCents: 20000,
        etaLabel: 'Até 24 horas',
      });
    });
  });

  describe('requestQiWithdraw', () => {
    it('debits only the balance of the requested side', async () => {
      const svc = new MockQiService();
      await svc.requestQiWithdraw('client', 3000, 'pix_cpf_1');
      expect((await svc.getQiSummary('client')).balanceCents).toBe(4409);
      expect((await svc.getQiSummary('merchant')).balanceCents).toBe(8909);

      await svc.requestQiWithdraw('merchant', 5000, 'pix_cpf_1');
      expect((await svc.getQiSummary('merchant')).balanceCents).toBe(3909);
      expect((await svc.getQiSummary('client')).balanceCents).toBe(4409);
    });

    it('rejects below the R$ 30,00 minimum', async () => {
      const svc = new MockQiService();
      await expect(svc.requestQiWithdraw('client', 2999, 'pix_cpf_1')).rejects.toThrow();
      expect((await svc.getQiSummary('client')).balanceCents).toBe(7409);
    });

    it('rejects above the side balance', async () => {
      const svc = new MockQiService();
      await expect(svc.requestQiWithdraw('client', 8000, 'pix_cpf_1')).rejects.toThrow();
      expect((await svc.getQiSummary('client')).balanceCents).toBe(7409);
    });

    it('rejects an empty pixKeyId', async () => {
      const svc = new MockQiService();
      await expect(svc.requestQiWithdraw('client', 3000, '')).rejects.toThrow();
      expect((await svc.getQiSummary('client')).balanceCents).toBe(7409);
    });
  });

  describe('{ empty: true }', () => {
    it('zeroes both summaries with the Bronze/5 goal', async () => {
      const svc = new MockQiService({ empty: true });
      const zeroed = {
        balanceCents: 0,
        totalEarnedCents: 0,
        indicadosCount: 0,
        bonusCount: 0,
        nextLevel: { name: 'Bronze', target: 5 },
      };
      await expect(svc.getQiSummary('client')).resolves.toEqual(zeroed);
      await expect(svc.getQiSummary('merchant')).resolves.toEqual(zeroed);
    });

    it('lists no indicacoes on page 1 (single empty page)', async () => {
      const svc = new MockQiService({ empty: true });
      const page = await svc.listIndicacoes('client', 1);
      expect(page.items).toEqual([]);
      expect(page.totalPages).toBe(1);
    });
  });
});
