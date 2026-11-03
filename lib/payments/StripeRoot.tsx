import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { getStripeConfig, type StripeConfig } from './stripeConfig';

interface Props {
  children: React.ReactElement | React.ReactElement[];
  /** Só para teste; o app usa a config do `expoConfig.extra`. */
  config?: StripeConfig;
}

/**
 * Envolve a árvore com o `StripeProvider` quando o provedor é a Stripe. No
 * mock renderiza os filhos direto: nada do SDK nativo é tocado.
 */
export function StripeRoot({ children, config }: Props) {
  const resolved = config ?? getStripeConfig();
  if (resolved.provider !== 'stripe') return <>{children}</>;
  return (
    <StripeProvider publishableKey={resolved.publishableKey} urlScheme="walltoall">
      {children}
    </StripeProvider>
  );
}
