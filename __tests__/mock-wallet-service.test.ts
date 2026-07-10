import { MockWalletService, maskPixValue } from '../lib/services/mock/mockWalletService';

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

  // ── F3: cartões, chaves Pix, extrato e carteira do lojista ─────────────────

  describe('maskPixValue', () => {
    it('masks a CPF keeping the last 2 digits', () => {
      expect(maskPixValue('cpf', '123.456.789-12')).toBe('*********-12');
      expect(maskPixValue('cpf', '12345678912')).toBe('*********-12');
    });

    it('masks a CNPJ keeping the last 2 digits', () => {
      expect(maskPixValue('cnpj', '12.345.678/0001-99')).toBe('************-99');
    });

    it('masks an email keeping the first char and the domain', () => {
      expect(maskPixValue('email', 'ana@gmail.com')).toBe('a***@gmail.com');
    });

    it('masks an email without @ using just the first char', () => {
      expect(maskPixValue('email', 'ana')).toBe('a***');
    });

    it('masks a phone keeping the last 4 digits', () => {
      expect(maskPixValue('phone', '(11) 98765-4321')).toBe('(**) *****-4321');
    });

    it('shows the first 8 chars of a random key with an ellipsis', () => {
      expect(maskPixValue('random', 'abcdefghijkl')).toBe('abcdefgh…');
    });

    it('shows a short random key in full', () => {
      expect(maskPixValue('random', 'abc')).toBe('abc');
    });
  });

  describe('addCard', () => {
    it('derives the brand from the number prefix', async () => {
      const svc = new MockWalletService();
      const visa = await svc.addCard({
        number: '4111 1111 1111 1234',
        holderName: 'JOAO SILVA',
        expiry: '10/29',
        cvv: '123',
      });
      const master = await svc.addCard({
        number: '5555 5555 5555 5678',
        holderName: 'JOAO SILVA',
        expiry: '10/29',
        cvv: '123',
      });
      const amex = await svc.addCard({
        number: '3782 822463 10005',
        holderName: 'JOAO SILVA',
        expiry: '10/29',
        cvv: '1234',
      });
      const elo = await svc.addCard({
        number: '6363 6800 0000 0007',
        holderName: 'JOAO SILVA',
        expiry: '10/29',
        cvv: '123',
      });
      expect(visa.brand).toBe('visa');
      expect(master.brand).toBe('mastercard');
      expect(amex.brand).toBe('amex');
      expect(elo.brand).toBe('elo');
    });

    it('stores the last 4 digits and is not default, growing getCards by 1', async () => {
      const svc = new MockWalletService();
      const before = await svc.getCards();
      const card = await svc.addCard({
        number: '4111 1111 1111 1234',
        holderName: 'JOAO SILVA',
        expiry: '10/29',
        cvv: '123',
      });
      expect(card.last4).toBe('1234');
      expect(card.isDefault).toBe(false);
      expect(card.holderName).toBe('JOAO SILVA');
      expect(card.expiry).toBe('10/29');
      const after = await svc.getCards();
      expect(after).toHaveLength(before.length + 1);
      expect(after.some((c) => c.id === card.id)).toBe(true);
    });
  });

  describe('addPixKey / getPixKeys', () => {
    it('returns the fixture CPF key by default', async () => {
      const svc = new MockWalletService();
      const keys = await svc.getPixKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0]).toMatchObject({ type: 'cpf', maskedValue: '*********-12' });
    });

    it('masks and appends a new key, never storing the raw value', async () => {
      const svc = new MockWalletService();
      const key = await svc.addPixKey({ type: 'email', value: 'ana@gmail.com' });
      expect(key.type).toBe('email');
      expect(key.maskedValue).toBe('a***@gmail.com');
      const keys = await svc.getPixKeys();
      expect(keys).toHaveLength(2);
      expect(keys.some((k) => k.maskedValue === '*********-12')).toBe(true);
      expect(keys.some((k) => k.maskedValue === 'a***@gmail.com')).toBe(true);
      // Nenhuma chave guarda o valor cru.
      expect(keys.every((k) => !k.maskedValue.includes('ana@gmail.com'))).toBe(true);
    });

    it('getPixKeys returns defensive copies (mutation does not leak)', async () => {
      const svc = new MockWalletService();
      const first = await svc.getPixKeys();
      first[0].maskedValue = 'HACKED';
      const second = await svc.getPixKeys();
      expect(second[0].maskedValue).toBe('*********-12');
    });
  });

  describe('statement (client)', () => {
    it('is empty', async () => {
      const svc = new MockWalletService();
      await expect(svc.getStatement()).resolves.toEqual([]);
    });
  });

  describe('merchant balance and statement', () => {
    it('exposes the fixture balance', async () => {
      const svc = new MockWalletService();
      await expect(svc.getMerchantBalanceCents()).resolves.toBe(59120);
    });

    it('returns the 4 fixture entries including a positive Furou Fila credit', async () => {
      const svc = new MockWalletService();
      const statement = await svc.getMerchantStatement();
      expect(statement).toHaveLength(4);
      const furaFila = statement.find((e) => e.title === 'Furou Fila');
      expect(furaFila).toBeDefined();
      expect(furaFila?.kind).toBe('fura_fila');
      expect(furaFila?.amountCents).toBeGreaterThan(0);
    });

    it('getMerchantStatement returns defensive copies (mutation does not leak)', async () => {
      const svc = new MockWalletService();
      const first = await svc.getMerchantStatement();
      first[0].amountCents = 999999;
      const second = await svc.getMerchantStatement();
      expect(second.some((e) => e.amountCents === 999999)).toBe(false);
    });
  });

  describe('requestWithdraw', () => {
    it('debits the balance and adds a negative withdraw entry', async () => {
      const svc = new MockWalletService();
      const [pixKey] = await svc.getPixKeys();
      const before = await svc.getMerchantBalanceCents();
      const beforeLen = (await svc.getMerchantStatement()).length;

      await svc.requestWithdraw(5000, pixKey.id);

      const after = await svc.getMerchantBalanceCents();
      expect(after).toBe(before - 5000);
      const statement = await svc.getMerchantStatement();
      expect(statement).toHaveLength(beforeLen + 1);
      const withdraw = statement.find((e) => e.kind === 'withdraw');
      expect(withdraw).toBeDefined();
      expect(withdraw?.amountCents).toBe(-5000);
      expect(withdraw?.title).toBe('Saque');
      expect(withdraw?.subtitle).toBe(pixKey.maskedValue);
    });

    it('rejects when the amount exceeds the balance', async () => {
      const svc = new MockWalletService();
      const [pixKey] = await svc.getPixKeys();
      await expect(svc.requestWithdraw(999999, pixKey.id)).rejects.toThrow();
      // Estado inalterado após a falha.
      await expect(svc.getMerchantBalanceCents()).resolves.toBe(59120);
    });

    it('rejects when the pix key is unknown', async () => {
      const svc = new MockWalletService();
      await expect(svc.requestWithdraw(1000, 'pix_unknown')).rejects.toThrow();
      await expect(svc.getMerchantBalanceCents()).resolves.toBe(59120);
    });

    it('rejects when the amount is not positive', async () => {
      const svc = new MockWalletService();
      const [pixKey] = await svc.getPixKeys();
      await expect(svc.requestWithdraw(0, pixKey.id)).rejects.toThrow();
      await expect(svc.requestWithdraw(-100, pixKey.id)).rejects.toThrow();
    });
  });
});
