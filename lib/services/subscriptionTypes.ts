import type { CardBrand, PaymentCard } from './types';

/**
 * Assinatura do lojista (F7). Domínio próprio, fora de `types.ts`, no mesmo
 * padrão de `bookingTypes.ts` e `feedTypes.ts`.
 *
 * Quem cobra é o SERVIÇO, não a tela: `subscribe` recebe o cartão e devolve a
 * assinatura já com o resultado da 1ª cobrança, como o Stripe Billing faz com
 * `payment_behavior: 'default_incomplete'`. A Task 17 da F8 troca só esta
 * implementação, mapeando o status do Stripe para `SubscriptionStatus` e
 * `cancel_at_period_end` para `cancelAtPeriodEnd`.
 */

/** Espelha os status que a Task 17 da F8 mapeia a partir do Stripe Billing. */
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete';

/** 'open' = fatura emitida e não paga (pendente ou tentativa recusada). */
export type SubscriptionInvoiceStatus = 'paid' | 'open';

export interface SubscriptionPlan {
  id: string;
  /** "Wall to All Premium" */
  name: string;
  /** "PLANO ÚNICO" */
  badge: string;
  description: string;
  /** Centavos (2990 = R$ 29,90). */
  priceCents: number;
  interval: 'month';
  /** Itens de "O que está incluso", na ordem do Figma. */
  features: string[];
}

export interface SubscriptionCard {
  id: string;
  brand: CardBrand;
  last4: string;
}

export interface Subscription {
  id: string;
  planId: string;
  priceCents: number;
  status: SubscriptionStatus;
  /** true = cancelada pelo lojista, mas ainda 'active' até currentPeriodEnd. */
  cancelAtPeriodEnd: boolean;
  /** ISO 8601: próxima cobrança, ou fim do acesso quando cancelAtPeriodEnd. */
  currentPeriodEnd: string;
  card: SubscriptionCard | null;
}

export interface SubscriptionInvoice {
  id: string;
  amountCents: number;
  status: SubscriptionInvoiceStatus;
  /** ISO 8601 da emissão. */
  createdAt: string;
}

export interface SubscriptionService {
  getPlan(): Promise<SubscriptionPlan>;
  /** null = nunca assinou. */
  getSubscription(): Promise<Subscription | null>;
  /**
   * Cobra a 1ª fatura no cartão. Recusa NÃO lança: devolve status 'incomplete'.
   * Já 'active' ou 'past_due' → lança. Recebe o `PaymentCard` inteiro porque o
   * mock exibe bandeira e últimos dígitos; a implementação Stripe usa só `id`.
   */
  subscribe(card: PaymentCard): Promise<Subscription>;
  /** Troca o cartão. Em 'past_due', tenta cobrar a fatura aberta (aprovado → 'active'). */
  updatePaymentCard(card: PaymentCard): Promise<Subscription>;
  /** Liga cancelAtPeriodEnd (idempotente). Sem assinatura ativa → lança. */
  cancel(): Promise<Subscription>;
  /** Desliga cancelAtPeriodEnd (idempotente). Sem assinatura ativa → lança. */
  resume(): Promise<Subscription>;
  /** Mais recente primeiro. */
  getInvoices(): Promise<SubscriptionInvoice[]>;
}
