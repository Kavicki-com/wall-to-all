import { payoutAccountStatus } from '../supabase/functions/_shared/accountFlags.ts';
import { accountLinkUrls, v2AccountBody } from '../supabase/functions/_shared/connectAccount.ts';
import { returnPage } from '../supabase/functions/_shared/returnPage.ts';

describe('payoutAccountStatus', () => {
  it('sem conta: none', () => {
    expect(payoutAccountStatus(null)).toBe('none');
  });

  it('conta com pendências (sem payouts): pending', () => {
    expect(payoutAccountStatus({ payoutsEnabled: false, disconnected: false })).toBe('pending');
  });

  it('active só com payouts_enabled', () => {
    expect(payoutAccountStatus({ payoutsEnabled: true, disconnected: false })).toBe('active');
  });

  it('conta desconectada volta a none', () => {
    expect(payoutAccountStatus({ payoutsEnabled: true, disconnected: true })).toBe('none');
  });
});

describe('v2AccountBody', () => {
  const body = v2AccountBody({
    businessId: 39,
    email: 'lojista@example.com',
    displayName: 'Barbearia Demo',
  });

  it('BR, dashboard express, plataforma responde por taxas e perdas', () => {
    expect(body).toMatchObject({
      contact_email: 'lojista@example.com',
      display_name: 'Barbearia Demo',
      identity: { country: 'br' },
      dashboard: 'express',
      defaults: {
        responsibilities: { fees_collector: 'application', losses_collector: 'application' },
      },
      metadata: { business_id: '39' },
    });
  });

  it('pede card_payments e stripe_transfers (spike g: um exige o outro)', () => {
    expect(body.configuration).toEqual({
      merchant: { capabilities: { card_payments: { requested: true } } },
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
    });
  });

  it('sem e-mail não cria conta (contact_email é obrigatório na v2)', () => {
    expect(() => v2AccountBody({ businessId: 39, email: null, displayName: 'X' })).toThrow();
  });

  it('nome vazio cai para um rótulo genérico', () => {
    expect(v2AccountBody({ businessId: 39, email: 'a@b.co', displayName: '  ' }).display_name).toBe(
      'Negócio 39',
    );
  });
});

describe('accountLinkUrls', () => {
  it('return e refresh apontam para connect-return', () => {
    expect(accountLinkUrls('https://x.supabase.co/functions/v1/connect-return/')).toEqual({
      return_url: 'https://x.supabase.co/functions/v1/connect-return?state=done',
      refresh_url: 'https://x.supabase.co/functions/v1/connect-return?state=refresh',
    });
  });

  it('exige https', () => {
    expect(() => accountLinkUrls('walltoall://financeiro')).toThrow();
  });
});

describe('returnPage', () => {
  it('done: redireciona para o Financeiro com onboarding=done', () => {
    expect(returnPage('done')).toEqual({
      location: 'walltoall://financeiro?onboarding=done',
      message: expect.stringContaining('Volte para o app'),
    });
  });

  it('refresh: deep link próprio e orienta reabrir pelo app', () => {
    const page = returnPage('refresh');
    expect(page.location).toBe('walltoall://financeiro?onboarding=refresh');
    expect(page.message).toMatch(/Ativar recebimentos/);
  });

  it('estado desconhecido ou ausente é tratado como refresh (nunca ecoa a entrada)', () => {
    expect(returnPage('<script>')).toEqual(returnPage('refresh'));
    expect(returnPage(null)).toEqual(returnPage('refresh'));
  });
});
