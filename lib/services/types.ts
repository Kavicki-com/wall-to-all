// ── Fila (Aqui e Agora) ────────────────────────────────────
export type QueueStatus = 'inactive' | 'active' | 'paused' | 'full';
export type TicketStatus = 'waiting' | 'called' | 'served' | 'no_show' | 'left';

export interface QueueTicket {
  id: string;
  number: number;
  customerName: string;
  /** ISO 8601 */
  joinedAt: string;
  isFuraFila: boolean;
  status: TicketStatus;
  /** 0 = sendo atendido */
  positionInLine: number;
  estimatedWaitMinutes: number;
}

export interface QueueSettings {
  furaFilaEnabled: boolean;
  furaFilaPriceCents: number;
  maxSize: number;
  avgServiceMinutes: number;
  /** Raio de visibilidade no mapa, em km (0,5–10). Distância máxima para clientes te encontrarem no "Aqui e Agora". */
  visibilityRadiusKm: number;
  /** Encerramento automático do modo Aqui e Agora, em minutos; `null` = "Não encerrar". */
  autoCloseMinutes: number | null;
}

export interface QueueInfo {
  merchantId: string;
  merchantName: string;
  status: QueueStatus;
  ticketsWaiting: number;
  estimatedWaitMinutes: number;
  nowServingNumber: number | null;
  settings: QueueSettings;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface NearbyMerchant {
  id: string;
  name: string;
  category: string;
  coordinate: LatLng;
  distanceKm: number;
  rating: number;
  queue: QueueInfo;
}

export interface QueueService {
  // cliente
  getNearbyMerchants(center: LatLng): Promise<NearbyMerchant[]>;
  getQueueInfo(merchantId: string): Promise<QueueInfo>;
  joinQueue(merchantId: string, opts?: { furaFila?: boolean }): Promise<QueueTicket>;
  leaveQueue(ticketId: string): Promise<void>;
  getMyTicket(): Promise<QueueTicket | null>;
  /** Emite a cada mudança da fila; NÃO emite imediatamente no subscribe. Use getMyTicket()/getMerchantQueue() para o snapshot inicial. Retorna função de unsubscribe. */
  subscribeToTicket(ticketId: string, cb: (ticket: QueueTicket) => void): () => void;
  // lojista
  getMerchantQueue(): Promise<QueueTicket[]>;
  /** Emite a cada mudança da fila; NÃO emite imediatamente no subscribe. Use getMyTicket()/getMerchantQueue() para o snapshot inicial. Retorna função de unsubscribe. */
  subscribeToMerchantQueue(cb: (tickets: QueueTicket[]) => void): () => void;
  setQueueStatus(status: QueueStatus): Promise<void>;
  callNext(): Promise<QueueTicket | null>;
  resolveTicket(ticketId: string, outcome: 'served' | 'no_show'): Promise<void>;
  getSettings(): Promise<QueueSettings>;
  updateSettings(settings: Partial<QueueSettings>): Promise<QueueSettings>;
}

// ── Carteira (subset usado na F1; completa na F3) ──────────
export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex';

export interface PaymentCard {
  id: string;
  brand: CardBrand;
  last4: string;
  holderName: string;
  /** MM/YY */
  expiry: string;
  isDefault: boolean;
}

export interface PixCharge {
  /** Payload EMV (BR Code) a ser renderizado como QR pela UI — mesmo conteúdo do copyPasteCode, NÃO uma imagem/data-URI. */
  qrCode: string;
  copyPasteCode: string;
  amountCents: number;
  /** ISO 8601 */
  expiresAt: string;
}

// ── Chaves Pix, extrato e carteira do lojista (F3) ─────────
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface PixKey {
  id: string;
  type: PixKeyType;
  /** Valor JÁ MASCARADO para exibição (privacidade por construção). */
  maskedValue: string;
  /** ISO 8601 */
  createdAt: string;
}

export type WalletEntryKind = 'service' | 'fura_fila' | 'withdraw';

export interface WalletEntry {
  id: string;
  kind: WalletEntryKind;
  /** "Corte de cabelo masc." | "Furou Fila" | "Saque" */
  title: string;
  /** nome do cliente | "Taxa de antecipação Fura Fila" | chave de destino */
  subtitle: string;
  /** positivo = crédito, negativo = débito (saque). Em centavos. */
  amountCents: number;
  /** ISO 8601 */
  date: string;
}

export interface WalletService {
  getCards(): Promise<PaymentCard[]>;
  createPixCharge(amountCents: number, description: string): Promise<PixCharge>;
  payWithCard(
    cardId: string,
    amountCents: number,
    description: string,
  ): Promise<{ status: 'approved' | 'declined' }>;
  // cliente (F3)
  addCard(input: { number: string; holderName: string; expiry: string; cvv: string }): Promise<PaymentCard>;
  getPixKeys(): Promise<PixKey[]>;
  addPixKey(input: { type: PixKeyType; value: string }): Promise<PixKey>;
  getStatement(): Promise<WalletEntry[]>;
  // lojista (F3)
  getMerchantBalanceCents(): Promise<number>;
  getMerchantStatement(): Promise<WalletEntry[]>;
  /** Cotação do saque (taxa/isenção) — mesma régua do QI (F4). */
  quoteWithdraw(amountCents: number): Promise<WithdrawQuote>;
  requestWithdraw(amountCents: number, pixKeyId: string): Promise<void>;
}

// ── QI: programa de indicações com cashback (F4) ───────────
export type QiSide = 'client' | 'merchant';

export interface QiSummary {
  balanceCents: number;      // "Saldo Cashback" do hero
  totalEarnedCents: number;  // "Lucro total"
  indicadosCount: number;
  bonusCount: number;
  /** Meta do próximo nível ("Indique 5 amigos para liberar nível Bronze"); null = nível máximo. */
  nextLevel: { name: string; target: number } | null;
}

export interface QiIndicacao {
  id: string;
  name: string;
  avatarUrl: string | null;
  earnedCents: number;               // "Você ganhou"
  status: 'active' | 'inactive';     // "Status da conta" (Ativa)
  indicatedAt: string;               // ISO — "Indicada em"
  firstAppointmentAt: string | null; // ISO — "Primeiro agendamento"
  lastActivityAt: string | null;     // ISO — "Última atividade"
  appointmentsCount: number;
}

export interface QiStatementEntry {
  id: string;
  title: string;      // "Agendamento realizado"
  subtitle: string;   // nome do cliente do agendamento
  date: string;       // ISO
  amountCents: number;
}

export interface QiProgramRules {
  perServicePct: number;         // 10
  monthlyBonusCents: number;     // 500
  topLevelMultiplier: number;    // 2 (Ouro → x2 cashback)
  /**
   * Quantidade de indicados ativos que libera o NÍVEL MÁXIMO da escada (Ouro).
   * É o mesmo limiar que o topo da escada expressa em `QiSummary.nextLevel`
   * ("Indique N amigos para liberar nível Ouro"): o card de ganhos do QI e a
   * tela "Como funciona" falam do mesmo número e não podem divergir, por isso
   * ele vive nas regras do programa em vez de literal em tela.
   */
  topLevelThreshold: number;     // 30
  minWithdrawCents: number;      // 3000
  feeCents: number;              // 500
  feeFreeThresholdCents: number; // 20000
  creditWindowHours: number;     // 24
}

export interface WithdrawQuote {
  amountCents: number;
  feeCents: number;
  totalCents: number; // amount - fee
  etaLabel: string;   // "Até 24 horas"
}

export interface QiService {
  getQiSummary(side: QiSide): Promise<QiSummary>;
  getQiCode(side: QiSide): Promise<string>; // "QI-HOG23-3892"
  listIndicacoes(side: QiSide, page: number): Promise<{ items: QiIndicacao[]; page: number; totalPages: number }>;
  getIndicacao(side: QiSide, id: string): Promise<QiIndicacao>;
  getIndicacaoStatement(side: QiSide, id: string): Promise<QiStatementEntry[]>;
  getProgramRules(): Promise<QiProgramRules>;
  quoteWithdraw(amountCents: number): Promise<WithdrawQuote>;
  requestQiWithdraw(side: QiSide, amountCents: number, pixKeyId: string): Promise<void>;
}
