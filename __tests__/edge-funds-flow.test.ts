import { chooseFundsFlow } from '../supabase/functions/_shared/fundsFlow.ts';

// Decisão do design § 16 (02/11): a plataforma segura todos os fundos. Não há
// destination charge; o lojista recebe por transfer no "Sacar".
describe('chooseFundsFlow (edge _shared)', () => {
  it('booking com cartão ou Pix fica na plataforma', () => {
    expect(chooseFundsFlow({ purpose: 'booking', method: 'card' })).toBe('platform');
    expect(chooseFundsFlow({ purpose: 'booking', method: 'pix' })).toBe('platform');
  });

  it('fura-fila é sempre na plataforma', () => {
    expect(chooseFundsFlow({ purpose: 'fura_fila', method: 'card' })).toBe('platform');
    expect(chooseFundsFlow({ purpose: 'fura_fila', method: 'pix' })).toBe('platform');
  });

  it('assinatura é sempre na plataforma', () => {
    expect(chooseFundsFlow({ purpose: 'subscription', method: 'card' })).toBe('platform');
  });

  it('pagar na hora não move fundos', () => {
    expect(chooseFundsFlow({ purpose: 'booking', method: 'pay_on_site' })).toBe('none');
  });
});
