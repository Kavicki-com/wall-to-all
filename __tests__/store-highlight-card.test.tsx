/**
 * Testes de comportamento do StoreHighlightCard (F2 — Dashboards/Home, Task 2).
 *
 * Card apresentacional do negócio em destaque na home do cliente. Estes testes
 * cobrem: renderização de nome/descrição, faixa de preço (cifrões acesos vs
 * apagados via priceTier), chips de serviços, métodos de pagamento aceitos,
 * fallbacks (sem banner/logo/preços) e o disparo do onPress.
 *
 * Chip (DS) não consome contexto, então usamos o `render` puro do RTL — o
 * harness de providers seria inócuo aqui.
 */
import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { StoreHighlightCard } from '../components/home/StoreHighlightCard';
import type { Business } from '../lib/types';

// Fixture base: negócio completo (banner, logo, serviços com preço, pagamentos).
function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: 1,
    business_name: 'Hothog Barber Shop',
    logo_url: 'https://example.com/logo.png',
    description: 'Cortes masculinos e femininos',
    banner_url: 'https://example.com/banner.png',
    accepted_payment_methods: { pix: true, card: true, cash: true },
    work_days: {
      monday: { start: '10:00', end: '18:00' },
      tuesday: { start: '10:00', end: '18:00' },
    },
    services: [
      { id: 10, name: 'Corte masculino', price: 65 },
      { id: 11, name: 'Barba', price: 95 },
    ],
    ...overrides,
  };
}

describe('StoreHighlightCard', () => {
  it('renderiza o nome e a descrição do negócio', () => {
    const { getByText } = render(
      <StoreHighlightCard business={makeBusiness()} onPress={jest.fn()} />,
    );

    expect(getByText('Hothog Barber Shop')).toBeTruthy();
    expect(getByText('Cortes masculinos e femininos')).toBeTruthy();
  });

  it('acende a quantidade de cifrões conforme priceTier (preços [65,95] → média 80 → tier 2)', () => {
    const { getByTestId } = render(
      <StoreHighlightCard business={makeBusiness()} onPress={jest.fn()} />,
    );

    // Dois cifrões acesos (tier 2) e três apagados (5 - 2).
    expect(getByTestId('price-lit').props.children).toBe('$$');
    expect(getByTestId('price-dim').props.children).toBe('$$$');
  });

  it('renderiza um chip por serviço dentro da linha de chips', () => {
    const { getByTestId } = render(
      <StoreHighlightCard business={makeBusiness()} onPress={jest.fn()} />,
    );

    const chipsRow = within(getByTestId('service-chips'));
    expect(chipsRow.getByText('Corte masculino')).toBeTruthy();
    expect(chipsRow.getByText('Barba')).toBeTruthy();
  });

  it('mostra apenas os métodos de pagamento aceitos', () => {
    const business = makeBusiness({
      accepted_payment_methods: { pix: true, card: true },
    });
    const { getByText, queryByText } = render(
      <StoreHighlightCard business={business} onPress={jest.fn()} />,
    );

    expect(getByText('PIX')).toBeTruthy();
    expect(getByText('Cartão')).toBeTruthy();
    expect(queryByText('Dinheiro')).toBeNull();
  });

  it('aplica fallbacks sem banner/logo/preços: esconde "Preço médio", mostra iniciais e não quebra', () => {
    const business = makeBusiness({
      business_name: 'Barbearia Teste',
      logo_url: null,
      banner_url: null,
      services: [],
      accepted_payment_methods: null,
    });
    const { getByText, queryByText } = render(
      <StoreHighlightCard business={business} onPress={jest.fn()} />,
    );

    // Sem serviços com preço → sem linha "Preço médio".
    expect(queryByText('Preço médio')).toBeNull();
    // Sem logo → iniciais do nome (Barbearia Teste → BT).
    expect(getByText('BT')).toBeTruthy();
    // Sem pagamentos → sem seção "Pagamentos aceitos".
    expect(queryByText('Pagamentos aceitos')).toBeNull();
  });

  it('dispara onPress ao tocar no card', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <StoreHighlightCard business={makeBusiness()} onPress={onPress} />,
    );

    fireEvent.press(getByTestId('store-highlight-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
