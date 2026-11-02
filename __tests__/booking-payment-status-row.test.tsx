import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BookingPaymentStatusRow } from '../components/booking/BookingPaymentStatusRow';
import type { BookingPayment } from '../lib/services/bookingTypes';

const base: BookingPayment = {
  appointmentId: 1,
  status: 'paid',
  method: 'pix',
  amountCents: 6500,
  cardLast4: null,
  cardBrand: null,
  paidAt: '2099-03-15T10:00:00.000Z',
};

describe('BookingPaymentStatusRow', () => {
  it('shows the card paid with its last digits', () => {
    render(
      <BookingPaymentStatusRow
        payment={{ ...base, method: 'card', cardLast4: '4242', cardBrand: 'visa' }}
      />,
    );
    expect(screen.getByText('Pago com cartão •••• 4242')).toBeTruthy();
  });

  it('shows pix paid', () => {
    render(<BookingPaymentStatusRow payment={base} />);
    expect(screen.getByText('Pago via Pix')).toBeTruthy();
  });

  it('shows pay on site with the chosen method', () => {
    render(
      <BookingPaymentStatusRow
        payment={{ ...base, status: 'pay_on_site', method: 'card', paidAt: null }}
      />,
    );
    expect(screen.getByText('Pagar na hora (Cartão)')).toBeTruthy();
  });

  it('falls back to the appointment payment method without a record', () => {
    render(<BookingPaymentStatusRow payment={null} fallbackMethod="pix" />);
    expect(screen.getByText('Pagamento: Pix')).toBeTruthy();
  });

  it('renders nothing without record and fallback', () => {
    render(<BookingPaymentStatusRow payment={null} />);
    expect(screen.toJSON()).toBeNull();
  });
});
