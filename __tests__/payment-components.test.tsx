import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CardBrandFlag } from '../components/payment/CardBrandFlag';
import { CreditCard } from '../components/payment/CreditCard';
import { PaymentCardRow } from '../components/payment/PaymentCardRow';
import { CardsStack } from '../components/payment/CardsStack';
import type { PaymentCard } from '../lib/services/types';

const visaCard: PaymentCard = {
  id: 'c1',
  brand: 'visa',
  last4: '4242',
  holderName: 'GABRIEL FERNANDES',
  expiry: '08/28',
  isDefault: true,
};

const masterCard: PaymentCard = {
  id: 'c2',
  brand: 'mastercard',
  last4: '5100',
  holderName: 'MARIA SILVA',
  expiry: '11/27',
  isDefault: false,
};

const eloCard: PaymentCard = {
  id: 'c3',
  brand: 'elo',
  last4: '6363',
  holderName: 'JOAO SOUZA',
  expiry: '02/29',
  isDefault: false,
};

// Extrai o translateY do array de transform de um slot da pilha.
function slotTranslateY(testID: string): number | undefined {
  const style = StyleSheet.flatten(screen.getByTestId(testID).props.style) as {
    transform?: Array<Record<string, number>>;
  };
  return style.transform?.find((t) => 'translateY' in t)?.translateY;
}

describe('CardBrandFlag', () => {
  it('renders the visa mark with its brand testID and accessibilityLabel', () => {
    render(<CardBrandFlag brand="visa" />);
    const flag = screen.getByTestId('card-brand-visa');
    expect(flag).toBeTruthy();
    expect(flag.props.accessibilityLabel).toBe('Bandeira Visa');
  });

  it('renders the mastercard mark with its brand testID and accessibilityLabel', () => {
    render(<CardBrandFlag brand="mastercard" />);
    const flag = screen.getByTestId('card-brand-mastercard');
    expect(flag).toBeTruthy();
    expect(flag.props.accessibilityLabel).toBe('Bandeira Mastercard');
  });

  it('renders a distinct mark per brand (elo/amex fallbacks included)', () => {
    const { rerender } = render(<CardBrandFlag brand="elo" />);
    expect(screen.getByTestId('card-brand-elo')).toBeTruthy();
    rerender(<CardBrandFlag brand="amex" />);
    expect(screen.getByTestId('card-brand-amex')).toBeTruthy();
  });
});

describe('CreditCard', () => {
  it('renders the masked number ending in last4', () => {
    render(<CreditCard card={visaCard} />);
    expect(screen.getByText('•••• •••• •••• 4242')).toBeTruthy();
  });

  it('renders the holder name', () => {
    render(<CreditCard card={visaCard} />);
    expect(screen.getByText('GABRIEL FERNANDES')).toBeTruthy();
  });

  it('shows the flag for its brand', () => {
    render(<CreditCard card={masterCard} />);
    expect(screen.getByTestId('card-brand-mastercard')).toBeTruthy();
  });

  it('forwards testID to the root', () => {
    render(<CreditCard card={visaCard} testID="my-card" />);
    expect(screen.getByTestId('my-card')).toBeTruthy();
  });
});

describe('PaymentCardRow', () => {
  it('renders the short masked number with last4', () => {
    render(<PaymentCardRow card={visaCard} />);
    expect(screen.getByText('•••• 4242')).toBeTruthy();
  });

  it('renders the brand flag', () => {
    render(<PaymentCardRow card={masterCard} />);
    expect(screen.getByTestId('card-brand-mastercard')).toBeTruthy();
  });

  it('fires onPress when the row is pressed', () => {
    const onPress = jest.fn();
    render(<PaymentCardRow card={visaCard} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reflects the selected state in accessibilityState', () => {
    render(<PaymentCardRow card={visaCard} selected />);
    expect(screen.getByRole('button').props.accessibilityState.selected).toBe(true);
  });

  it('is not selected by default', () => {
    render(<PaymentCardRow card={visaCard} />);
    expect(screen.getByRole('button').props.accessibilityState.selected).toBe(false);
  });
});

describe('CardsStack', () => {
  const cards = [visaCard, masterCard];

  it('renders one pressable per card', () => {
    render(<CardsStack cards={cards} />);
    expect(screen.getAllByRole('button')).toHaveLength(cards.length);
  });

  it('offsets each card by depth so the stack is visible (activeIndex 0)', () => {
    // Caminho real da F1: activeIndex 0 → profundidades monotônicas 0,1,2, então
    // cada slot deve receber um translateY distinto (a pilha realmente escalona).
    render(<CardsStack cards={[visaCard, masterCard, eloCard]} activeIndex={0} />);
    const offsets = [0, 1, 2].map((i) => slotTranslateY(`cards-stack-card-${i}`));
    expect(offsets[0]).toBeCloseTo(0); // ativo não desloca (-0 é aceitável)
    expect(new Set(offsets).size).toBe(3); // cada profundidade tem offset distinto
  });

  it('fires onSelect with the tapped card and its index', () => {
    const onSelect = jest.fn();
    render(<CardsStack cards={cards} onSelect={onSelect} />);
    fireEvent.press(screen.getByLabelText(/5100/));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(masterCard, 1);
  });

  it('renders nothing to press when there are no cards', () => {
    render(<CardsStack cards={[]} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
