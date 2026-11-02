import { chooseFundsFlow } from '../supabase/functions/_shared/fundsFlow.ts';

const active = { payoutsEnabled: true };
const pending = { payoutsEnabled: false };

describe('chooseFundsFlow (edge _shared)', () => {
  const pixOk = { pixDestinationSupported: true };
  const pixNo = { pixDestinationSupported: false };

  it('booking com cartão e conta ativa usa destination charge', () => {
    expect(
      chooseFundsFlow({ purpose: 'booking', method: 'card', merchantAccount: active }, pixNo),
    ).toBe('destination');
  });

  it('booking com Pix usa destination só se o spike aprovou', () => {
    expect(
      chooseFundsFlow({ purpose: 'booking', method: 'pix', merchantAccount: active }, pixOk),
    ).toBe('destination');
    expect(
      chooseFundsFlow({ purpose: 'booking', method: 'pix', merchantAccount: active }, pixNo),
    ).toBe('platform');
  });

  it('lojista sem conta ativa cai na plataforma', () => {
    expect(
      chooseFundsFlow({ purpose: 'booking', method: 'card', merchantAccount: pending }, pixOk),
    ).toBe('platform');
    expect(
      chooseFundsFlow({ purpose: 'booking', method: 'card', merchantAccount: null }, pixOk),
    ).toBe('platform');
  });

  it('fura-fila é sempre na plataforma', () => {
    expect(
      chooseFundsFlow({ purpose: 'fura_fila', method: 'card', merchantAccount: active }, pixOk),
    ).toBe('platform');
    expect(
      chooseFundsFlow({ purpose: 'fura_fila', method: 'pix', merchantAccount: null }, pixOk),
    ).toBe('platform');
  });

  it('assinatura é sempre na plataforma', () => {
    expect(
      chooseFundsFlow({ purpose: 'subscription', method: 'card', merchantAccount: active }, pixOk),
    ).toBe('platform');
  });

  it('pagar na hora não move fundos', () => {
    expect(
      chooseFundsFlow(
        { purpose: 'booking', method: 'pay_on_site', merchantAccount: active },
        pixOk,
      ),
    ).toBe('none');
  });
});
