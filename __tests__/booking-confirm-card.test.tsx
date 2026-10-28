import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  BookingConfirmCard,
  type BookingConfirmCardProps,
} from '../components/booking/BookingConfirmCard';
import type { PaymentCard } from '../lib/services/types';

const visa: PaymentCard = {
  id: 'card_visa_1',
  brand: 'visa',
  last4: '4242',
  holderName: 'ANA',
  expiry: '08/28',
  isDefault: true,
};

function renderCard(overrides: Partial<BookingConfirmCardProps> = {}) {
  const props: BookingConfirmCardProps = {
    serviceName: 'Corte de cabelo Masculino',
    priceCents: 6500,
    dateTimeLabel: 'Hoje 14/05/2026 - 10h',
    businessName: 'Hothog Barber Shop',
    address: 'Avenida Um, 1255 - Guarujá',
    logoUrl: undefined,
    method: 'pix',
    onChangeMethod: jest.fn(),
    selectedCard: visa,
    onChangeCard: jest.fn(),
    observations: '',
    onChangeObservations: jest.fn(),
    onPayNow: jest.fn(),
    onPayOnSite: jest.fn(),
    submitting: false,
    payNowDisabled: false,
    ...overrides,
  };
  render(<BookingConfirmCard {...props} />);
  return props;
}

describe('BookingConfirmCard', () => {
  it('renders service, price, date and store', () => {
    renderCard();
    expect(screen.getByText('Confirmar agendamento')).toBeTruthy();
    expect(screen.getByText('SERVIÇO SOLICITADO')).toBeTruthy();
    expect(screen.getByText('Corte de cabelo Masculino')).toBeTruthy();
    expect(screen.getByText('R$ 65,00')).toBeTruthy();
    expect(screen.getByText('A pagar')).toBeTruthy();
    expect(screen.getByText('Hoje 14/05/2026 - 10h')).toBeTruthy();
    expect(screen.getByText('Hothog Barber Shop')).toBeTruthy();
    expect(screen.getByText('Avenida Um, 1255 - Guarujá')).toBeTruthy();
  });

  it('calls onChangeMethod when a radio is pressed', () => {
    const props = renderCard();
    fireEvent.press(screen.getByText('Cartão'));
    expect(props.onChangeMethod).toHaveBeenCalledWith('card');
    fireEvent.press(screen.getByText('Dinheiro'));
    expect(props.onChangeMethod).toHaveBeenCalledWith('cash');
  });

  it('shows the selected card row with Alterar for card', () => {
    const props = renderCard({ method: 'card' });
    expect(screen.getByText('Pagamento com Cartão')).toBeTruthy();
    expect(screen.getByText('•••• 4242')).toBeTruthy();
    expect(screen.getByTestId('card-brand-visa')).toBeTruthy();
    fireEvent.press(screen.getByText('Alterar'));
    expect(props.onChangeCard).toHaveBeenCalledTimes(1);
  });

  it('shows the empty card state when there is no saved card', () => {
    renderCard({ method: 'card', selectedCard: null });
    expect(screen.getByText('Nenhum cartão salvo')).toBeTruthy();
  });

  it('shows the pix row without Alterar', () => {
    renderCard({ method: 'pix' });
    expect(screen.getByText('Pagamento via PIX')).toBeTruthy();
    expect(screen.getByText('QR Code na próxima etapa')).toBeTruthy();
    expect(screen.queryByText('Alterar')).toBeNull();
  });

  it('has no method row for cash', () => {
    renderCard({ method: 'cash' });
    expect(screen.queryByText('Pagamento via PIX')).toBeNull();
    expect(screen.queryByText('Pagamento com Cartão')).toBeNull();
  });

  it('wires the two CTAs', () => {
    const props = renderCard();
    fireEvent.press(screen.getByText('Realizar pagamento'));
    expect(props.onPayNow).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Pagar na hora'));
    expect(props.onPayOnSite).toHaveBeenCalledTimes(1);
  });

  it('disables Realizar pagamento when payNowDisabled', () => {
    const props = renderCard({ payNowDisabled: true });
    const cta = screen.getByRole('button', { name: 'Realizar pagamento' });
    expect(cta.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(cta);
    expect(props.onPayNow).not.toHaveBeenCalled();
  });

  it('reports typing in Observações', () => {
    const props = renderCard();
    fireEvent.changeText(screen.getByLabelText('Observações'), 'Sem pressa');
    expect(props.onChangeObservations).toHaveBeenCalledWith('Sem pressa');
  });
});
