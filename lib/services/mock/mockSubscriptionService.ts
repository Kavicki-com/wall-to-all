import type { PaymentCard } from '../types';
import type {
  Subscription,
  SubscriptionCard,
  SubscriptionInvoice,
  SubscriptionPlan,
  SubscriptionService,
} from '../subscriptionTypes';

/**
 * Latência simulada (ms) para uso no app real. Mesmo design dos outros mocks:
 * o construtor aceita `latencyMs` com default **0** (testes resolvem via
 * microtask), e o ServicesProvider passa `SIMULATED_LATENCY_MS` explicitamente.
 */
export const SIMULATED_LATENCY_MS = 300;

export interface MockSubscriptionServiceOptions {
  /** Latência simulada (ms) das operações. Default 0 (ver SIMULATED_LATENCY_MS). */
  latencyMs?: number;
  /**
   * Estado inicial. 'none' (default) abre na Oferta; 'active' semeia cartão
   * •••• 4242 e 4 faturas pagas; 'past_due' tem a fatura mais recente aberta;
   * 'canceling' = 'active' com cancelAtPeriodEnd.
   */
  initial?: 'none' | 'active' | 'past_due' | 'canceling';
  /** Ids de cartão cuja cobrança é recusada (simula recusa do emissor). */
  declineCardIds?: string[];
  /** Relógio injetável para testes determinísticos. */
  now?: () => Date;
}

const PLAN: SubscriptionPlan = {
  id: 'plan_premium_monthly',
  name: 'Wall to All Premium',
  badge: 'PLANO ÚNICO',
  description: 'Acesso completo à plataforma para o seu negócio crescer.',
  priceCents: 2990,
  interval: 'month',
  features: [
    'Agendamentos ilimitados',
    'Dashboard completo com métricas',
    'Sistema de indicações (Quem Indica)',
    'Carteira financeira e saques via PIX',
    'Cadastro ilimitado de serviços',
    'Suporte prioritário ao lojista',
  ],
};

/** Dia do mês em que a assinatura semeada é cobrada (Figma: "14 jun 2026"). */
const SEED_BILLING_DAY = 14;
const SEED_INVOICE_COUNT = 4;
const SEED_CARD: SubscriptionCard = { id: 'card_visa_1', brand: 'visa', last4: '4242' };

/**
 * Datas sempre ao meio-dia UTC: evita que a data exibida vire o dia no fuso do
 * Brasil (UTC-3).
 */
function atNoonUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

/** Soma meses mantendo o dia; 31/01 + 1 mês = último dia de fevereiro (como no Billing). */
function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return atNoonUtc(year, month, Math.min(date.getUTCDate(), lastDay));
}

function toCard(card: PaymentCard): SubscriptionCard {
  return { id: card.id, brand: card.brand, last4: card.last4 };
}

/**
 * Assinatura do lojista em memória. Não persiste: some ao recarregar o app,
 * aceitável enquanto o pagamento é mock (a Task 17 da F8 troca por Stripe
 * Billing). O próprio serviço cobra o cartão; recusa vira 'incomplete'
 * (assinar) ou mantém 'past_due' (trocar cartão), sem lançar.
 */
export class MockSubscriptionService implements SubscriptionService {
  private readonly latencyMs: number;
  private readonly declineCardIds: Set<string>;
  private readonly now: () => Date;
  private subscription: Subscription | null = null;
  private invoices: SubscriptionInvoice[] = [];
  private sequence = 0;

  constructor(options: MockSubscriptionServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.declineCardIds = new Set(options.declineCardIds ?? []);
    this.now = options.now ?? (() => new Date());
    const initial = options.initial ?? 'none';
    if (initial !== 'none') {
      this.seed(initial);
    }
  }

  async getPlan(): Promise<SubscriptionPlan> {
    await this.delay();
    return { ...PLAN, features: [...PLAN.features] };
  }

  async getSubscription(): Promise<Subscription | null> {
    await this.delay();
    return this.subscription ? this.copy(this.subscription) : null;
  }

  async subscribe(card: PaymentCard): Promise<Subscription> {
    await this.delay();
    const current = this.subscription;
    if (current && (current.status === 'active' || current.status === 'past_due')) {
      throw new Error('Você já tem uma assinatura ativa.');
    }

    const today = this.today();
    const approved = !this.declineCardIds.has(card.id);
    // Uma assinatura 'incomplete' ou 'canceled' é substituída por uma nova,
    // como no Billing, onde a incompleta expira e a fatura dela é anulada.
    this.subscription = {
      id: this.nextId('sub'),
      planId: PLAN.id,
      priceCents: PLAN.priceCents,
      status: approved ? 'active' : 'incomplete',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: addMonths(today, 1).toISOString(),
      card: toCard(card),
    };
    this.invoices = [
      {
        id: this.nextId('inv'),
        amountCents: PLAN.priceCents,
        status: approved ? 'paid' : 'open',
        createdAt: today.toISOString(),
      },
    ];
    return this.copy(this.subscription);
  }

  async updatePaymentCard(card: PaymentCard): Promise<Subscription> {
    await this.delay();
    const current = this.requireLive();
    current.card = toCard(card);
    if (current.status === 'past_due' && !this.declineCardIds.has(card.id)) {
      // Cobra a fatura aberta no cartão novo.
      this.invoices = this.invoices.map((invoice) =>
        invoice.status === 'open' ? { ...invoice, status: 'paid' } : invoice,
      );
      current.status = 'active';
    }
    return this.copy(current);
  }

  async cancel(): Promise<Subscription> {
    await this.delay();
    const current = this.requireLive();
    current.cancelAtPeriodEnd = true;
    return this.copy(current);
  }

  async resume(): Promise<Subscription> {
    await this.delay();
    const current = this.requireLive();
    current.cancelAtPeriodEnd = false;
    return this.copy(current);
  }

  async getInvoices(): Promise<SubscriptionInvoice[]> {
    await this.delay();
    return this.invoices.map((invoice) => ({ ...invoice }));
  }

  private seed(initial: 'active' | 'past_due' | 'canceling'): void {
    const today = this.today();
    // Última cobrança: dia 14 deste mês se já passou, senão do mês anterior.
    const monthOffset = today.getUTCDate() >= SEED_BILLING_DAY ? 0 : -1;
    const lastBilling = atNoonUtc(
      today.getUTCFullYear(),
      today.getUTCMonth() + monthOffset,
      SEED_BILLING_DAY,
    );

    this.invoices = Array.from({ length: SEED_INVOICE_COUNT }, (_, index) => ({
      id: this.nextId('inv'),
      amountCents: PLAN.priceCents,
      status: initial === 'past_due' && index === 0 ? 'open' : 'paid',
      createdAt: addMonths(lastBilling, -index).toISOString(),
    }));
    this.subscription = {
      id: this.nextId('sub'),
      planId: PLAN.id,
      priceCents: PLAN.priceCents,
      status: initial === 'past_due' ? 'past_due' : 'active',
      cancelAtPeriodEnd: initial === 'canceling',
      currentPeriodEnd: addMonths(lastBilling, 1).toISOString(),
      card: { ...SEED_CARD },
    };
  }

  /** Assinatura 'active' ou 'past_due'; qualquer outro estado lança. */
  private requireLive(): Subscription {
    const current = this.subscription;
    if (!current || (current.status !== 'active' && current.status !== 'past_due')) {
      throw new Error('Nenhuma assinatura ativa.');
    }
    return current;
  }

  private today(): Date {
    const now = this.now();
    return atNoonUtc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_mock_${this.sequence}`;
  }

  private copy(subscription: Subscription): Subscription {
    return { ...subscription, card: subscription.card ? { ...subscription.card } : null };
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
