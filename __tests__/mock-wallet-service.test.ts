import { MockWalletService } from '../lib/services/mock/mockWalletService';

describe('MockWalletService', () => {
  it('returns mock cards with a default card', async () => {
    const svc = new MockWalletService();
    const cards = await svc.getCards();
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.filter((c) => c.isDefault)).toHaveLength(1);
  });

  it('creates a pix charge with copy-paste code and expiry', async () => {
    const svc = new MockWalletService();
    const charge = await svc.createPixCharge(1500, 'Fura fila — Barbearia X');
    expect(charge.copyPasteCode).toMatch(/^000201/); // formato EMV do BR Code
    expect(new Date(charge.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('approves card payment for known card', async () => {
    const svc = new MockWalletService();
    const [card] = await svc.getCards();
    const result = await svc.payWithCard(card.id, 1500, 'Fura fila');
    expect(result.status).toBe('approved');
  });

  // ── Testes adicionais (além dos três do plano) ─────────────────────────────

  it('declines card payment for an unknown card', async () => {
    const svc = new MockWalletService();
    const result = await svc.payWithCard('unknown-card-id', 1500, 'Fura fila');
    expect(result.status).toBe('declined');
  });

  it('includes a visa and a mastercard card', async () => {
    const svc = new MockWalletService();
    const cards = await svc.getCards();
    expect(cards.some((c) => c.brand === 'visa')).toBe(true);
    expect(cards.some((c) => c.brand === 'mastercard')).toBe(true);
  });

  it('pix charge embeds the exact amount and sets qrCode equal to copyPasteCode', async () => {
    const svc = new MockWalletService();
    const charge = await svc.createPixCharge(2599, 'Fura fila');
    expect(charge.amountCents).toBe(2599);
    expect(charge.qrCode).toBe(charge.copyPasteCode);
    expect(charge.qrCode).toMatch(/^000201/);
  });

  it('pix charge expires ~15 minutes from now', async () => {
    const svc = new MockWalletService();
    const before = Date.now();
    const charge = await svc.createPixCharge(1500, 'Fura fila');
    const after = Date.now();
    const fifteenMin = 15 * 60 * 1000;
    const expiresAt = new Date(charge.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + fifteenMin);
    expect(expiresAt).toBeLessThanOrEqual(after + fifteenMin);
  });

  it('getCards returns defensive copies (mutation does not leak)', async () => {
    const svc = new MockWalletService();
    const first = await svc.getCards();
    first[0].isDefault = !first[0].isDefault;
    first[0].last4 = '0000';
    const second = await svc.getCards();
    expect(second.filter((c) => c.isDefault)).toHaveLength(1);
    expect(second[0].last4).not.toBe('0000');
  });
});
