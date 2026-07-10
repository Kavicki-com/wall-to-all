import type {
  LatLng,
  NearbyMerchant,
  QueueInfo,
  QueueService,
  QueueSettings,
  QueueStatus,
  QueueTicket,
} from '../types';
import {
  DEFAULT_QUEUE_SETTINGS,
  FIXTURE_MERCHANTS,
  FIXTURE_TICKETS,
  LIVE_MERCHANT_ID,
} from './queueFixtures';

/**
 * Latência simulada (ms) para uso no app real.
 *
 * Design: o construtor aceita `latencyMs` com default **0**. Os testes rodam
 * sob fake timers e dão `await` direto nas operações sem avançar o relógio —
 * um `setTimeout(300)` real deixaria as Promises pendentes para sempre
 * (deadlock). Com `latencyMs === 0` o delay resolve via microtask
 * (`Promise.resolve()`); com valor > 0 usa `setTimeout`. O ServicesProvider
 * (Task 6) passa `SIMULATED_LATENCY_MS` explicitamente para simular latência
 * de rede realista dentro do app.
 */
export const SIMULATED_LATENCY_MS = 300;

/** Intervalo default do timer que avança a fila simulada. */
export const DEFAULT_TICK_INTERVAL_MS = 8000;

export interface MockQueueServiceOptions {
  /** Intervalo (ms) entre avanços automáticos da fila. Default 8000. */
  tickIntervalMs?: number;
  /** Latência simulada (ms) das operações. Default 0 — ver SIMULATED_LATENCY_MS. */
  latencyMs?: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Implementação mock de QueueService, 100% em memória, com "realtime"
 * simulado: um setInterval avança a fila (primeiro waiting → called,
 * decrementa positionInLine dos demais) e notifica os subscribers.
 * A fila interna pertence ao merchant LIVE_MERCHANT_ID ('m1'); os demais
 * merchants das fixtures têm QueueInfo estático.
 */
export class MockQueueService implements QueueService {
  private readonly latencyMs: number;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  private readonly merchants: NearbyMerchant[];
  private tickets: QueueTicket[];
  private settings: QueueSettings;
  /** Default 'active' — coerente com as fixtures já terem tickets waiting. */
  private queueStatus: QueueStatus = 'active';
  private myTicket: QueueTicket | null = null;

  private nextTicketSeq: number;
  private nextTicketNumber: number;

  private readonly ticketSubscribers = new Map<string, Set<(ticket: QueueTicket) => void>>();
  private readonly merchantQueueSubscribers = new Set<(tickets: QueueTicket[]) => void>();

  constructor(options: MockQueueServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.merchants = FIXTURE_MERCHANTS.map((merchant) => ({
      ...merchant,
      coordinate: { ...merchant.coordinate },
      queue: { ...merchant.queue, settings: { ...merchant.queue.settings } },
    }));
    this.tickets = FIXTURE_TICKETS.map((ticket) => ({ ...ticket }));
    this.settings = { ...DEFAULT_QUEUE_SETTINGS };
    this.nextTicketSeq = FIXTURE_TICKETS.length + 1;
    this.nextTicketNumber = Math.max(0, ...FIXTURE_TICKETS.map((ticket) => ticket.number)) + 1;
    const tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
    this.tickHandle = setInterval(() => this.tick(), tickIntervalMs);
  }

  /** Limpa o interval de simulação. Chamar ao descartar o serviço. */
  dispose(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  // ── cliente ────────────────────────────────────────────────

  async getNearbyMerchants(center: LatLng): Promise<NearbyMerchant[]> {
    await this.delay();
    return this.merchants
      .map((merchant) => ({
        ...merchant,
        coordinate: { ...merchant.coordinate },
        distanceKm: Math.round(haversineKm(center, merchant.coordinate) * 10) / 10,
        queue: this.buildQueueInfo(merchant),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getQueueInfo(merchantId: string): Promise<QueueInfo> {
    await this.delay();
    return this.buildQueueInfo(this.requireMerchant(merchantId));
  }

  async joinQueue(merchantId: string, opts?: { furaFila?: boolean }): Promise<QueueTicket> {
    await this.delay();
    this.requireMerchant(merchantId);
    const isFuraFila = opts?.furaFila ?? false;
    const waiting = this.tickets.filter((ticket) => ticket.status === 'waiting');
    let positionInLine: number;
    if (isFuraFila) {
      // Fura-fila entra na posição 1 (atrás apenas de quem está sendo atendido).
      positionInLine = 1;
      for (const ticket of waiting) {
        ticket.positionInLine += 1;
        ticket.estimatedWaitMinutes = this.estimateWait(ticket.positionInLine);
      }
    } else {
      positionInLine =
        waiting.length > 0 ? Math.max(...waiting.map((ticket) => ticket.positionInLine)) + 1 : 1;
    }
    const ticket: QueueTicket = {
      id: `t${this.nextTicketSeq++}`,
      number: this.nextTicketNumber++,
      customerName: 'Você',
      joinedAt: new Date().toISOString(),
      isFuraFila,
      status: 'waiting',
      positionInLine,
      estimatedWaitMinutes: this.estimateWait(positionInLine),
    };
    this.tickets.push(ticket);
    this.myTicket = ticket;
    this.emitChange();
    return { ...ticket };
  }

  async leaveQueue(ticketId: string): Promise<void> {
    await this.delay();
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    this.removeTicket(ticket, 'left');
    this.emitChange();
  }

  async getMyTicket(): Promise<QueueTicket | null> {
    await this.delay();
    return this.myTicket ? { ...this.myTicket } : null;
  }

  subscribeToTicket(ticketId: string, cb: (ticket: QueueTicket) => void): () => void {
    const callbacks =
      this.ticketSubscribers.get(ticketId) ?? new Set<(ticket: QueueTicket) => void>();
    this.ticketSubscribers.set(ticketId, callbacks);
    callbacks.add(cb);
    return () => {
      callbacks.delete(cb);
      if (callbacks.size === 0) {
        this.ticketSubscribers.delete(ticketId);
      }
    };
  }

  // ── lojista ────────────────────────────────────────────────

  async getMerchantQueue(): Promise<QueueTicket[]> {
    await this.delay();
    return this.snapshotQueue();
  }

  subscribeToMerchantQueue(cb: (tickets: QueueTicket[]) => void): () => void {
    this.merchantQueueSubscribers.add(cb);
    return () => {
      this.merchantQueueSubscribers.delete(cb);
    };
  }

  async setQueueStatus(status: QueueStatus): Promise<void> {
    await this.delay();
    this.queueStatus = status;
  }

  async callNext(): Promise<QueueTicket | null> {
    await this.delay();
    const hadCalled = this.tickets.some((ticket) => ticket.status === 'called');
    const next = this.advanceQueue();
    if (hadCalled || next) {
      this.emitChange();
    }
    return next ? { ...next } : null;
  }

  async resolveTicket(ticketId: string, outcome: 'served' | 'no_show'): Promise<void> {
    await this.delay();
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    this.removeTicket(ticket, outcome);
    this.emitChange();
  }

  async getSettings(): Promise<QueueSettings> {
    await this.delay();
    return { ...this.settings };
  }

  async updateSettings(settings: Partial<QueueSettings>): Promise<QueueSettings> {
    await this.delay();
    // Merge que ignora chaves com valor undefined (não sobrescreve). `autoCloseMinutes`
    // é anulável (null = "Não encerrar"), então usa guarda `!== undefined` em vez de
    // `??` — senão um null explícito seria descartado a favor do valor atual.
    this.settings = {
      furaFilaEnabled: settings.furaFilaEnabled ?? this.settings.furaFilaEnabled,
      furaFilaPriceCents: settings.furaFilaPriceCents ?? this.settings.furaFilaPriceCents,
      maxSize: settings.maxSize ?? this.settings.maxSize,
      avgServiceMinutes: settings.avgServiceMinutes ?? this.settings.avgServiceMinutes,
      visibilityRadiusKm: settings.visibilityRadiusKm ?? this.settings.visibilityRadiusKm,
      autoCloseMinutes:
        settings.autoCloseMinutes !== undefined
          ? settings.autoCloseMinutes
          : this.settings.autoCloseMinutes,
    };
    for (const ticket of this.tickets) {
      if (ticket.status === 'waiting') {
        ticket.estimatedWaitMinutes = this.estimateWait(ticket.positionInLine);
      }
    }
    this.emitChange();
    return { ...this.settings };
  }

  // ── internos ───────────────────────────────────────────────

  /**
   * Latência simulada: com latencyMs === 0 resolve via microtask para não
   * travar testes com fake timers; com > 0 usa setTimeout de verdade.
   */
  private async delay(): Promise<void> {
    if (this.latencyMs === 0) {
      await Promise.resolve();
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
  }

  private tick(): void {
    if (this.queueStatus !== 'active') return;
    const hadCalled = this.tickets.some((ticket) => ticket.status === 'called');
    const next = this.advanceQueue();
    if (hadCalled || next) {
      this.emitChange();
    }
  }

  /**
   * Avança a fila: resolve o ticket 'called' atual como 'served' e promove o
   * primeiro 'waiting' para 'called' (posição 0), decrementando a posição dos
   * demais. Retorna o ticket promovido (ou null se não havia waiting).
   */
  private advanceQueue(): QueueTicket | null {
    const current = this.tickets.find((ticket) => ticket.status === 'called');
    if (current) {
      this.removeTicket(current, 'served');
    }
    const waiting = this.tickets
      .filter((ticket) => ticket.status === 'waiting')
      .sort((a, b) => a.positionInLine - b.positionInLine);
    const next = waiting[0];
    if (!next) return null;
    const promotedFrom = next.positionInLine;
    next.status = 'called';
    next.positionInLine = 0;
    next.estimatedWaitMinutes = 0;
    for (const ticket of waiting.slice(1)) {
      if (ticket.positionInLine > promotedFrom) {
        ticket.positionInLine -= 1;
        ticket.estimatedWaitMinutes = this.estimateWait(ticket.positionInLine);
      }
    }
    return next;
  }

  /**
   * Remove um ticket da fila com status final, ajusta as posições dos tickets
   * atrás dele e emite a última notificação para os subscribers do ticket.
   */
  private removeTicket(ticket: QueueTicket, finalStatus: 'served' | 'no_show' | 'left'): void {
    const removedPosition = ticket.positionInLine;
    ticket.status = finalStatus;
    this.tickets = this.tickets.filter((t) => t.id !== ticket.id);
    if (removedPosition >= 1) {
      for (const t of this.tickets) {
        if (t.status === 'waiting' && t.positionInLine > removedPosition) {
          t.positionInLine -= 1;
          t.estimatedWaitMinutes = this.estimateWait(t.positionInLine);
        }
      }
    }
    if (this.myTicket?.id === ticket.id) {
      this.myTicket = null;
    }
    this.notifyTicketSubscribers(ticket);
  }

  /** Notifica subscribers de tickets ainda na fila e da fila do lojista. */
  private emitChange(): void {
    for (const [ticketId, callbacks] of this.ticketSubscribers) {
      const ticket = this.tickets.find((t) => t.id === ticketId);
      if (!ticket) continue;
      for (const cb of [...callbacks]) {
        this.invokeTicketCb(cb, ticket);
      }
    }
    for (const cb of [...this.merchantQueueSubscribers]) {
      // Isola cada subscriber: um throw não pode abortar o loop nem escapar
      // do setInterval (red-box no RN/Hermes).
      try {
        cb(this.snapshotQueue());
      } catch (err) {
        console.error('[MockQueueService] merchant queue subscriber threw', err);
      }
    }
  }

  private notifyTicketSubscribers(ticket: QueueTicket): void {
    const callbacks = this.ticketSubscribers.get(ticket.id);
    if (!callbacks) return;
    for (const cb of [...callbacks]) {
      this.invokeTicketCb(cb, ticket);
    }
  }

  /**
   * Invoca um subscriber de ticket com uma cópia defensiva, isolando erros:
   * um throw não pode abortar o loop de notificação nem escapar do setInterval.
   */
  private invokeTicketCb(cb: (ticket: QueueTicket) => void, ticket: QueueTicket): void {
    try {
      cb({ ...ticket });
    } catch (err) {
      console.error('[MockQueueService] ticket subscriber threw', err);
    }
  }

  private snapshotQueue(): QueueTicket[] {
    return [...this.tickets]
      .sort((a, b) => a.positionInLine - b.positionInLine)
      .map((ticket) => ({ ...ticket }));
  }

  private buildQueueInfo(merchant: NearbyMerchant): QueueInfo {
    if (merchant.id !== LIVE_MERCHANT_ID) {
      return { ...merchant.queue, settings: { ...merchant.queue.settings } };
    }
    const waitingCount = this.tickets.filter((ticket) => ticket.status === 'waiting').length;
    const called = this.tickets.find((ticket) => ticket.status === 'called');
    return {
      merchantId: merchant.id,
      merchantName: merchant.name,
      status: this.queueStatus,
      ticketsWaiting: waitingCount,
      estimatedWaitMinutes: waitingCount * this.settings.avgServiceMinutes,
      nowServingNumber: called ? called.number : null,
      settings: { ...this.settings },
    };
  }

  private requireMerchant(merchantId: string): NearbyMerchant {
    const merchant = this.merchants.find((m) => m.id === merchantId);
    if (!merchant) {
      throw new Error(`Merchant não encontrado: ${merchantId}`);
    }
    return merchant;
  }

  private estimateWait(positionInLine: number): number {
    return Math.max(0, positionInLine) * this.settings.avgServiceMinutes;
  }
}
