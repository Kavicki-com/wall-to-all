import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CardSelectionBottomSheet } from '../components/payment/CardSelectionBottomSheet';
import type { PaymentCard } from '../lib/services/types';

const visa: PaymentCard = {
  id: 'card_visa_1',
  brand: 'visa',
  last4: '4242',
  holderName: 'ANA',
  expiry: '08/28',
  isDefault: true,
};
const master: PaymentCard = {
  id: 'card_master_1',
  brand: 'mastercard',
  last4: '5454',
  holderName: 'ANA',
  expiry: '11/27',
  isDefault: false,
};

function zIndexOf(testID: string): number {
  return (StyleSheet.flatten(screen.getByTestId(testID).props.style) as { zIndex: number }).zIndex;
}

describe('CardSelectionBottomSheet', () => {
  it('renders nothing when not visible', () => {
    render(
      <CardSelectionBottomSheet
        visible={false}
        cards={[visa, master]}
        selectedCardId="card_visa_1"
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText('Meus cartões')).toBeNull();
  });

  it('shows the stack with the selected card in front', () => {
    render(
      <CardSelectionBottomSheet
        visible
        cards={[visa, master]}
        selectedCardId="card_master_1"
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Meus cartões')).toBeTruthy();
    expect(zIndexOf('cards-stack-card-1')).toBeGreaterThan(zIndexOf('cards-stack-card-0'));
  });

  it('brings a tapped card to the front and selects it', () => {
    const onSelect = jest.fn();
    render(
      <CardSelectionBottomSheet
        visible
        cards={[visa, master]}
        selectedCardId="card_visa_1"
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(zIndexOf('cards-stack-card-0')).toBeGreaterThan(zIndexOf('cards-stack-card-1'));
    fireEvent.press(screen.getByTestId('cards-stack-card-1'));
    expect(zIndexOf('cards-stack-card-1')).toBeGreaterThan(zIndexOf('cards-stack-card-0'));
    fireEvent.press(screen.getByText('Selecionar cartão'));
    expect(onSelect).toHaveBeenCalledWith(master);
  });

  it('closes on backdrop press', () => {
    const onClose = jest.fn();
    render(
      <CardSelectionBottomSheet
        visible
        cards={[visa]}
        selectedCardId="card_visa_1"
        onSelect={jest.fn()}
        onClose={onClose}
      />,
    );
    // O sheet usa accessibilityViewIsModal, que esconde o backdrop irmão das queries.
    fireEvent.press(screen.getByTestId('card-selection-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state with a disabled CTA when there are no cards', () => {
    const onSelect = jest.fn();
    render(
      <CardSelectionBottomSheet
        visible
        cards={[]}
        selectedCardId={null}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Nenhum cartão salvo')).toBeTruthy();
    const cta = screen.getByRole('button', { name: 'Selecionar cartão' });
    expect(cta.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(cta);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
