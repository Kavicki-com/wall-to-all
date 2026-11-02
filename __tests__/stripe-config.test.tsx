import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { resolveStripeConfig } from '../lib/payments/stripeConfig';
import { StripeRoot } from '../lib/payments/StripeRoot';
import { logger } from '../lib/logger';

describe('resolveStripeConfig', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('sem configuração: mock', () => {
    expect(resolveStripeConfig(undefined)).toEqual({ provider: 'mock' });
    expect(resolveStripeConfig({})).toEqual({ provider: 'mock' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('stripe com publishable key de teste', () => {
    expect(
      resolveStripeConfig({ paymentsProvider: 'stripe', stripePublishableKey: 'pk_test_abc' }),
    ).toEqual({ provider: 'stripe', publishableKey: 'pk_test_abc' });
  });

  it('stripe sem publishable key: cai para mock com aviso', () => {
    expect(resolveStripeConfig({ paymentsProvider: 'stripe' })).toEqual({ provider: 'mock' });
    expect(warn).toHaveBeenCalled();
  });

  it('chave que não é publishable (pk_): cai para mock com aviso', () => {
    expect(
      resolveStripeConfig({ paymentsProvider: 'stripe', stripePublishableKey: 'abc' }),
    ).toEqual({ provider: 'mock' });
    expect(warn).toHaveBeenCalled();
  });

  it('secret ou restricted key no app: lança, mesmo com provider mock', () => {
    expect(() =>
      resolveStripeConfig({ paymentsProvider: 'stripe', stripePublishableKey: 'sk_test_x' }),
    ).toThrow(/secret/i);
    expect(() =>
      resolveStripeConfig({ paymentsProvider: 'mock', stripePublishableKey: 'rk_test_x' }),
    ).toThrow(/secret/i);
  });

  it('provider desconhecido: mock com aviso', () => {
    expect(resolveStripeConfig({ paymentsProvider: 'asaas' })).toEqual({ provider: 'mock' });
    expect(warn).toHaveBeenCalled();
  });
});

describe('StripeRoot', () => {
  it('mock: renderiza os filhos sem o StripeProvider', () => {
    render(
      <StripeRoot config={{ provider: 'mock' }}>
        <Text>conteúdo</Text>
      </StripeRoot>,
    );
    expect(screen.getByText('conteúdo')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(StripeProvider)).toHaveLength(0);
  });

  it('stripe: envolve com o StripeProvider (scheme walltoall)', () => {
    render(
      <StripeRoot config={{ provider: 'stripe', publishableKey: 'pk_test_abc' }}>
        <Text>conteúdo</Text>
      </StripeRoot>,
    );
    const providers = screen.UNSAFE_queryAllByType(StripeProvider);
    expect(providers).toHaveLength(1);
    expect(providers[0].props).toMatchObject({
      publishableKey: 'pk_test_abc',
      urlScheme: 'walltoall',
    });
  });
});
