/**
 * Assinatura do lojista no Stripe Billing (F8, Task 17), atrás do mesmo
 * `SubscriptionService` da F7. Fala com a Edge Function `subscriptions`
 * (`supabase/functions/subscriptions/index.ts`).
 *
 * O servidor cobra a 1ª fatura (e a fatura em atraso, ao trocar o cartão) na
 * hora. Quando o banco pede autenticação, a resposta traz `clientSecret`: o
 * SDK conclui o 3DS com `handleNextAction` e o serviço espera a assinatura
 * sair do estado anterior, até `pollTimeoutMs`. Recusa nunca lança, como no
 * mock: volta `incomplete` (assinar) ou `past_due` (trocar cartão).
 */

import { handleNextAction } from '@stripe/stripe-react-native';
import { SUBSCRIPTION_PLAN } from '../mock/mockSubscriptionService';
import type {
  Subscription,
  SubscriptionInvoice,
  SubscriptionPlan,
  SubscriptionService,
  SubscriptionStatus,
} from '../subscriptionTypes';
import type { PaymentCard } from '../types';
import { invokeEdge } from './edgeClient';
import { STRIPE_RETURN_URL } from './stripeWalletService';

const FUNCTION = 'subscriptions';

interface CurrentResponse {
  priceCents: number;
  subscription: Subscription | null;
}

interface ChangeResponse {
  subscription: Subscription;
  clientSecret: string | null;
}

export interface StripeSubscriptionServiceOptions {
  /** Intervalo entre as consultas depois do 3DS. Default 1,5 s. */
  pollIntervalMs?: number;
  /** Espera máxima pela confirmação depois do 3DS. Default 20 s. */
  pollTimeoutMs?: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class StripeSubscriptionService implements SubscriptionService {
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;

  constructor(options: StripeSubscriptionServiceOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1500;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 20000;
  }

  /** Texto do plano é o do Figma; o preço vem do Price da Stripe. */
  async getPlan(): Promise<SubscriptionPlan> {
    const { priceCents } = await this.current();
    return { ...SUBSCRIPTION_PLAN, features: [...SUBSCRIPTION_PLAN.features], priceCents };
  }

  async getSubscription(): Promise<Subscription | null> {
    return (await this.current()).subscription;
  }

  subscribe(card: PaymentCard): Promise<Subscription> {
    return this.change({ action: 'subscribe', paymentMethodId: card.id }, 'incomplete');
  }

  updatePaymentCard(card: PaymentCard): Promise<Subscription> {
    return this.change({ action: 'update_card', paymentMethodId: card.id }, 'past_due');
  }

  async cancel(): Promise<Subscription> {
    return (await invokeEdge<ChangeResponse>(FUNCTION, { body: { action: 'cancel' } })).subscription;
  }

  async resume(): Promise<Subscription> {
    return (await invokeEdge<ChangeResponse>(FUNCTION, { body: { action: 'resume' } })).subscription;
  }

  getInvoices(): Promise<SubscriptionInvoice[]> {
    return invokeEdge<SubscriptionInvoice[]>(FUNCTION, { body: { action: 'invoices' } });
  }

  private current(): Promise<CurrentResponse> {
    return invokeEdge<CurrentResponse>(FUNCTION, { method: 'GET' });
  }

  /**
   * Cobrança feita pelo servidor; com 3DS, autentica no SDK e espera a
   * assinatura deixar `pending` (o webhook e a Stripe confirmam a fatura).
   */
  private async change(
    body: Record<string, unknown>,
    pending: SubscriptionStatus,
  ): Promise<Subscription> {
    const response = await invokeEdge<ChangeResponse>(FUNCTION, { body });
    if (!response.clientSecret) return response.subscription;

    const result = await handleNextAction(response.clientSecret, STRIPE_RETURN_URL);
    if (result.error) return response.subscription;

    let latest = response.subscription;
    const deadline = Date.now() + this.pollTimeoutMs;
    while (Date.now() <= deadline) {
      await wait(this.pollIntervalMs);
      const { subscription } = await this.current();
      if (subscription) latest = subscription;
      if (latest.status !== pending) return latest;
    }
    return latest;
  }
}
