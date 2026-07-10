import type { PaymentCard, PixCharge, WalletService } from '../types';

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
}

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

/**
 * Implementação mock de WalletService, 100% em memória. Expõe dois cartões
 * fixos (Visa default + Mastercard), gera cobranças Pix com BR Code fake
 * estático e aprova pagamentos com cartão para IDs conhecidos (recusando os
 * desconhecidos). Todos os valores monetários são inteiros em centavos.
 */
export class MockWalletService implements WalletService {
  private readonly latencyMs: number;
  private readonly cards: PaymentCard[];

  constructor(options: MockWalletServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.cards = FIXTURE_CARDS.map((card) => ({ ...card }));
  }

  async getCards(): Promise<PaymentCard[]> {
    await this.delay();
    // Cópias defensivas: uma tela não pode mutar o estado interno.
    return this.cards.map((card) => ({ ...card }));
  }

  async createPixCharge(amountCents: number, description: string): Promise<PixCharge> {
    await this.delay();
    void description; // reservado para F3; não afeta o payload fake.
    const expiresAt = new Date(Date.now() + PIX_EXPIRY_MS).toISOString();
    return {
      // qrCode é o MESMO payload EMV do copyPasteCode (não uma imagem/data-URI).
      qrCode: FAKE_BR_CODE,
      copyPasteCode: FAKE_BR_CODE,
      amountCents,
      expiresAt,
    };
  }

  async payWithCard(
    cardId: string,
    amountCents: number,
    description: string,
  ): Promise<{ status: 'approved' | 'declined' }> {
    await this.delay();
    void amountCents;
    void description;
    const known = this.cards.some((card) => card.id === cardId);
    return { status: known ? 'approved' : 'declined' };
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
