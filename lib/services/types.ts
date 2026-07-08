// ── Fila (Aqui e Agora) ────────────────────────────────────
export type QueueStatus = 'inactive' | 'active' | 'paused' | 'full';
export type TicketStatus = 'waiting' | 'called' | 'served' | 'no_show' | 'left';

export interface QueueTicket {
  id: string;
  number: number;
  customerName: string;
  joinedAt: string; // ISO 8601
  isFuraFila: boolean;
  status: TicketStatus;
  positionInLine: number; // 0 = sendo atendido
  estimatedWaitMinutes: number;
}

export interface QueueSettings {
  furaFilaEnabled: boolean;
  furaFilaPriceCents: number;
  maxSize: number;
  avgServiceMinutes: number;
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
  subscribeToTicket(ticketId: string, cb: (ticket: QueueTicket) => void): () => void;
  // lojista
  getMerchantQueue(): Promise<QueueTicket[]>;
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
  expiry: string; // MM/YY
  isDefault: boolean;
}

export interface PixCharge {
  qrCode: string;
  copyPasteCode: string;
  amountCents: number;
  expiresAt: string; // ISO 8601
}

export interface WalletService {
  getCards(): Promise<PaymentCard[]>;
  createPixCharge(amountCents: number, description: string): Promise<PixCharge>;
  payWithCard(
    cardId: string,
    amountCents: number,
    description: string,
  ): Promise<{ status: 'approved' | 'declined' }>;
}
