import type {
  CardBrand,
  PaymentCard,
  PaymentRequestContext,
  PaymentStatus,
  PayoutAccountStatus,
  PixCharge,
  PixKey,
  PixKeyType,
  WalletEntry,
  WalletService,
  WithdrawQuote,
} from '../types';
import { computeWithdrawQuote } from './withdrawQuote';

/**
 * Latência simulada (ms) para uso no app real.
 *
 * Design: o construtor aceita `latencyMs` com default **0**. Os testes dão
 * `await` direto nas operações sem avançar relógio nenhum — com
 * `latencyMs === 0` o delay resolve via microtask (`Promise.resolve()`),
 * mantendo os testes rápidos; com valor > 0 usa `setTimeout` de verdade. O
 * ServicesProvider (Task 6) passa `SIMULATED_LATENCY_MS` explicitamente para
 * simular latência de rede realista dentro do app.
 */
export const SIMULATED_LATENCY_MS = 300;

/** Validade (ms) de uma cobrança Pix a partir da criação: 15 minutos. */
export const PIX_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Prefixo EMV/BR Code (Payload Format Indicator "000201") do payload Pix fake.
 * É uma string estática: não é um payload CRC16 válido, apenas o suficiente
 * para a UI renderizar um QR e o usuário "copiar e colar" no fluxo mock.
 */
const FAKE_BR_CODE =
  '000201' +
  '26580014br.gov.bcb.pix0136mock-fura-fila-00000000-0000-0000-0000' +
  '52040000' +
  '5303986' +
  '5802BR' +
  '5909Wall2All' +
  '6009Sao Paulo' +
  '62070503***' +
  '6304MOCK';

export interface MockWalletServiceOptions {
  /** Latência simulada (ms) das operações. Default 0 — ver SIMULATED_LATENCY_MS. */
  latencyMs?: number;
  /** F8: Pix confirmado na hora (default true); false deixa em 'processing'. */
  pixAutoConfirm?: boolean;
  /** F8: estado da conta de recebimento do lojista. Default 'active'. */
  payoutStatus?: PayoutAccountStatus;
  /** F8: finge o caminho da Stripe no cadastro de cartão (testes da tela). Default false. */
  cardSetupConfirmsWithStripe?: boolean;
}

/** Cartão devolvido pelo completeCardSetup (o mock não vê os dados do cartão). */
const SETUP_FIXTURE_CARD: Omit<PaymentCard, 'id'> = {
  brand: 'visa',
  last4: '4242',
  holderName: 'MARIA SILVA',
  expiry: '12/30',
  isDefault: false,
};

/** Dois cartões fixos: um Visa (default) e um Mastercard. */
const FIXTURE_CARDS: readonly PaymentCard[] = [
  {
    id: 'card_visa_1',
    brand: 'visa',
    last4: '4242',
    holderName: 'MARIA SILVA',
    expiry: '08/28',
    isDefault: true,
  },
  {
    id: 'card_mastercard_1',
    brand: 'mastercard',
    last4: '5454',
    holderName: 'MARIA SILVA',
    expiry: '11/27',
    isDefault: false,
  },
];

/** Uma chave Pix fixa (CPF) já mascarada, coerente com o Figma. */
const FIXTURE_PIX_KEYS: readonly PixKey[] = [
  {
    id: 'pix_cpf_1',
    type: 'cpf',
    maskedValue: '*********-12',
    createdAt: '2026-06-01T12:00:00.000Z',
  },
];

/** Saldo inicial do lojista (em centavos). */
const FIXTURE_MERCHANT_BALANCE_CENTS = 59120;

/**
 * Extrato do lojista — 4 créditos fixos espelhando o Figma `2602:5991`.
 * Datas ISO fixas (a tela ordena por data ao exibir).
 */
const FIXTURE_MERCHANT_STATEMENT: readonly WalletEntry[] = [
  {
    id: 'we_fura_1',
    kind: 'fura_fila',
    title: 'Furou Fila',
    subtitle: 'Taxa de antecipação Fura Fila',
    amountCents: 800,
    date: '2026-07-08T14:30:00.000Z',
  },
  {
    id: 'we_service_1',
    kind: 'service',
    title: 'Corte de cabelo masc.',
    subtitle: 'Carlos Silva',
    amountCents: 6500,
    date: '2026-07-08T13:10:00.000Z',
  },
  {
    id: 'we_service_2',
    kind: 'service',
    title: 'Barba e cabelo comp.',
    subtitle: 'Anderson Ribeiro',
    amountCents: 9500,
    date: '2026-07-07T17:45:00.000Z',
  },
  {
    id: 'we_service_3',
    kind: 'service',
    title: 'Tratamento folicular p.',
    subtitle: 'Silvio Santos',
    amountCents: 12050,
    date: '2026-07-07T10:20:00.000Z',
  },
];

/**
 * Deriva a bandeira do cartão pelo primeiro dígito do número (mock):
 * 4 → Visa, 5 → Mastercard, 3 → Amex, qualquer outro → Elo.
 */
function deriveCardBrand(digits: string): CardBrand {
  switch (digits[0]) {
    case '4':
      return 'visa';
    case '5':
      return 'mastercard';
    case '3':
      return 'amex';
    default:
      return 'elo';
  }
}

/**
 * Máscara de exibição para uma chave Pix, por tipo. Privacidade por
 * construção: a UI só recebe o valor mascarado, nunca o valor cru. Tipos
 * numéricos (cpf/cnpj/phone) têm os separadores descartados antes de mascarar.
 *
 * - cpf   → `*********-` + 2 últimos dígitos (ex.: `*********-12`)
 * - cnpj  → `************-` + 2 últimos dígitos
 * - email → 1ª letra + `***` + domínio a partir do `@` (sem `@`, só `letra***`)
 * - phone → `(**) *****-` + 4 últimos dígitos
 * - random→ 8 primeiros caracteres + `…` (ou a chave inteira se tiver ≤ 8)
 */
export function maskPixValue(type: PixKeyType, value: string): string {
  const digits = value.replace(/\D/g, '');
  switch (type) {
    case 'cpf':
      return `*********-${digits.slice(-2)}`;
    case 'cnpj':
      return `************-${digits.slice(-2)}`;
    case 'email': {
      const at = value.indexOf('@');
      if (at === -1) {
        return `${value.slice(0, 1)}***`;
      }
      return `${value.slice(0, 1)}***${value.slice(at)}`;
    }
    case 'phone':
      return `(**) *****-${digits.slice(-4)}`;
    case 'random':
      return value.length > 8 ? `${value.slice(0, 8)}…` : value;
  }
}

/**
 * Implementação mock de WalletService, 100% em memória. Expõe dois cartões
 * fixos (Visa default + Mastercard), gera cobranças Pix com BR Code fake
 * estático e aprova pagamentos com cartão para IDs conhecidos (recusando os
 * desconhecidos). Na F3 ganha cadastro de cartão/chave Pix, extrato do cliente
 * (vazio) e a carteira do lojista (saldo, extrato e saque). Todos os valores
 * monetários são inteiros em centavos.
 */
export class MockWalletService implements WalletService {
  private readonly latencyMs: number;
  private readonly cards: PaymentCard[];
  private readonly pixKeys: PixKey[];
  private readonly merchantStatement: WalletEntry[];
  private readonly clientStatement: WalletEntry[];
  private balanceCents: number;
  private nextCardSeq = 1;
  private nextPixSeq = 1;
  private nextEntrySeq = 1;
  private nextPaymentSeq = 1;
  private nextSetupSeq = 1;
  private readonly pixAutoConfirm: boolean;
  private readonly payoutStatus: PayoutAccountStatus;
  readonly cardSetupConfirmsWithStripe: boolean;
  /** Status por paymentId e paymentId por idempotencyKey (F8). */
  private readonly paymentStatuses = new Map<string, PaymentStatus>();
  private readonly paymentByKey = new Map<string, string>();
  private charges = 0;

  constructor(options: MockWalletServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.pixAutoConfirm = options.pixAutoConfirm ?? true;
    this.payoutStatus = options.payoutStatus ?? 'active';
    this.cardSetupConfirmsWithStripe = options.cardSetupConfirmsWithStripe ?? false;
    this.cards = FIXTURE_CARDS.map((card) => ({ ...card }));
    this.pixKeys = FIXTURE_PIX_KEYS.map((key) => ({ ...key }));
    this.merchantStatement = FIXTURE_MERCHANT_STATEMENT.map((entry) => ({ ...entry }));
    this.clientStatement = [];
    this.balanceCents = FIXTURE_MERCHANT_BALANCE_CENTS;
  }

  async getCards(): Promise<PaymentCard[]> {
    await this.delay();
    // Cópias defensivas: uma tela não pode mutar o estado interno.
    return this.cards.map((card) => ({ ...card }));
  }

  /** Só para teste: quantas cobranças de cartão foram de fato tentadas. */
  get chargeCount(): number {
    return this.charges;
  }

  async createPixCharge(
    amountCents: number,
    description: string,
    context?: PaymentRequestContext,
  ): Promise<PixCharge> {
    await this.delay();
    void description; // reservado para F3; não afeta o payload fake.
    const expiresAt = new Date(Date.now() + PIX_EXPIRY_MS).toISOString();
    const paymentId = this.paymentFor(context);
    if (this.paymentStatuses.get(paymentId) !== 'succeeded') {
      this.paymentStatuses.set(paymentId, this.pixAutoConfirm ? 'succeeded' : 'processing');
    }
    return {
      // qrCode é o MESMO payload EMV do copyPasteCode (não uma imagem/data-URI).
      qrCode: FAKE_BR_CODE,
      copyPasteCode: FAKE_BR_CODE,
      amountCents,
      expiresAt,
      paymentId,
      qrImageUrl: null,
    };
  }

  async payWithCard(
    cardId: string,
    amountCents: number,
    description: string,
    context?: PaymentRequestContext,
  ): Promise<{ status: 'approved' | 'declined'; paymentId?: string }> {
    await this.delay();
    void amountCents;
    void description;
    const paymentId = this.paymentFor(context);
    // Mesma chave já paga: não cobra de novo (espelha a idempotência do servidor).
    if (this.paymentStatuses.get(paymentId) === 'succeeded') {
      return { status: 'approved', paymentId };
    }
    this.charges += 1;
    const known = this.cards.some((card) => card.id === cardId);
    this.paymentStatuses.set(paymentId, known ? 'succeeded' : 'failed');
    return { status: known ? 'approved' : 'declined', paymentId };
  }

  // ── pagamentos reais (F8) ──────────────────────────────────

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    await this.delay();
    const status = this.paymentStatuses.get(paymentId);
    if (!status) throw new Error(`Pagamento não encontrado: ${paymentId}`);
    return status;
  }

  async beginCardSetup(): Promise<{ setupIntentClientSecret: string }> {
    await this.delay();
    const seq = this.nextSetupSeq++;
    return { setupIntentClientSecret: `seti_mock_${seq}_secret_mock${seq}` };
  }

  async completeCardSetup(setupIntentId: string): Promise<PaymentCard> {
    await this.delay();
    void setupIntentId;
    const card: PaymentCard = { ...SETUP_FIXTURE_CARD, id: `card_${this.nextCardSeq++}` };
    this.cards.push(card);
    return { ...card };
  }

  async getPayoutAccountStatus(): Promise<PayoutAccountStatus> {
    await this.delay();
    return this.payoutStatus;
  }

  async startPayoutOnboarding(): Promise<{ url: string }> {
    await this.delay();
    return { url: 'https://connect.stripe.com/setup/mock' };
  }

  /** paymentId da chave do contexto (o mesmo para a mesma chave); sem contexto, um novo. */
  private paymentFor(context?: PaymentRequestContext): string {
    const key = context?.idempotencyKey;
    const existing = key ? this.paymentByKey.get(key) : undefined;
    if (existing) return existing;
    const paymentId = `pay_mock_${this.nextPaymentSeq++}`;
    if (key) this.paymentByKey.set(key, paymentId);
    return paymentId;
  }

  // ── cliente (F3) ───────────────────────────────────────────

  /**
   * Cadastro com dados crus, só do mock (fora da interface desde a F8: o app
   * cadastra pelo CardField + SetupIntent).
   */
  async addCard(input: {
    number: string;
    holderName: string;
    expiry: string;
    cvv: string;
  }): Promise<PaymentCard> {
    await this.delay();
    void input.cvv; // CVV nunca é armazenado (mock).
    const digits = input.number.replace(/\D/g, '');
    const card: PaymentCard = {
      id: `card_${this.nextCardSeq++}`,
      brand: deriveCardBrand(digits),
      last4: digits.slice(-4),
      holderName: input.holderName,
      expiry: input.expiry,
      isDefault: false, // cartão novo nunca vira default automaticamente.
    };
    this.cards.push(card);
    return { ...card };
  }

  async getPixKeys(): Promise<PixKey[]> {
    await this.delay();
    return this.pixKeys.map((key) => ({ ...key }));
  }

  async addPixKey(input: { type: PixKeyType; value: string }): Promise<PixKey> {
    await this.delay();
    // Só o valor mascarado é persistido — o valor cru nunca entra no estado.
    const key: PixKey = {
      id: `pix_${this.nextPixSeq++}`,
      type: input.type,
      maskedValue: maskPixValue(input.type, input.value),
      createdAt: new Date().toISOString(),
    };
    this.pixKeys.push(key);
    return { ...key };
  }

  async getStatement(): Promise<WalletEntry[]> {
    await this.delay();
    return this.clientStatement.map((entry) => ({ ...entry }));
  }

  // ── lojista (F3) ───────────────────────────────────────────

  async getMerchantBalanceCents(): Promise<number> {
    await this.delay();
    return this.balanceCents;
  }

  async getMerchantStatement(): Promise<WalletEntry[]> {
    await this.delay();
    return this.merchantStatement.map((entry) => ({ ...entry }));
  }

  async quoteWithdraw(amountCents: number): Promise<WithdrawQuote> {
    await this.delay();
    // Mesma régua de taxa/isenção do QI (helper compartilhado — decisão #4).
    return computeWithdrawQuote(amountCents);
  }

  async requestWithdraw(amountCents: number, pixKeyId: string): Promise<void> {
    await this.delay();
    if (amountCents <= 0) {
      throw new Error('O valor do saque deve ser maior que zero.');
    }
    const pixKey = this.pixKeys.find((key) => key.id === pixKeyId);
    if (!pixKey) {
      throw new Error(`Chave Pix não encontrada: ${pixKeyId}`);
    }
    if (amountCents > this.balanceCents) {
      throw new Error('Saldo insuficiente para o saque.');
    }
    this.balanceCents -= amountCents;
    // Débito no extrato (amountCents negativo), no topo (mais recente primeiro).
    this.merchantStatement.unshift({
      id: `we_withdraw_${this.nextEntrySeq++}`,
      kind: 'withdraw',
      title: 'Saque',
      subtitle: pixKey.maskedValue,
      amountCents: -amountCents,
      date: new Date().toISOString(),
    });
  }

  /**
   * Latência simulada: com latencyMs === 0 resolve via microtask para manter
   * os testes rápidos; com > 0 usa setTimeout de verdade.
   */
  private async delay(): Promise<void> {
    if (this.latencyMs === 0) {
      await Promise.resolve();
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
