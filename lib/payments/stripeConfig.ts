/**
 * Qual provedor de pagamento o app usa (design § 6, Task 9 do plano F8).
 *
 * `extra.paymentsProvider` e `extra.stripePublishableKey` vêm do
 * `app.config.js` (`EXPO_PUBLIC_PAYMENTS_PROVIDER`,
 * `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`). Sem configuração válida o app fica no
 * mock, como antes da F8. Secret key (`sk_`) ou restricted key (`rk_`) no app
 * é erro de configuração grave: lança sempre, nunca segue.
 */

import Constants from 'expo-constants';
import { logger } from '../logger';

export type StripeConfig = { provider: 'mock' } | { provider: 'stripe'; publishableKey: string };

export interface PaymentsExtra {
  paymentsProvider?: unknown;
  stripePublishableKey?: unknown;
}

export function resolveStripeConfig(extra: PaymentsExtra | undefined): StripeConfig {
  const provider = extra?.paymentsProvider ?? 'mock';
  const key =
    typeof extra?.stripePublishableKey === 'string' ? extra.stripePublishableKey.trim() : '';

  if (key.startsWith('sk_') || key.startsWith('rk_')) {
    throw new Error(
      'Chave secret da Stripe no app. Use só a publishable key (pk_); a secret fica nos secrets do Supabase.',
    );
  }

  if (provider === 'mock') return { provider: 'mock' };
  if (provider !== 'stripe') {
    logger.warn(`[payments] provider desconhecido "${String(provider)}"; usando mock.`);
    return { provider: 'mock' };
  }
  if (!key.startsWith('pk_')) {
    logger.warn('[payments] provider stripe sem publishable key válida; usando mock.');
    return { provider: 'mock' };
  }
  return { provider: 'stripe', publishableKey: key };
}

let cached: StripeConfig | null = null;

/** Config do app em execução (lida uma vez do `expoConfig.extra`). */
export function getStripeConfig(): StripeConfig {
  cached ??= resolveStripeConfig(Constants.expoConfig?.extra as PaymentsExtra | undefined);
  return cached;
}
