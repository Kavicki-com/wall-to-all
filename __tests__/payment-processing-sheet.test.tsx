import React from 'react';
import { Modal } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PaymentProcessingSheet } from '../components/payment/PaymentProcessingSheet';

jest.mock('../lib/assets', () => ({
  IconLoading: () => null,
}));

describe('PaymentProcessingSheet', () => {
  it('renders the default message and the logo when visible', () => {
    render(<PaymentProcessingSheet visible />);
    expect(screen.getByText('Processando seu pagamento...')).toBeTruthy();
    expect(screen.getByTestId('payment-processing-logo')).toBeTruthy();
  });

  it('renders a custom message', () => {
    render(<PaymentProcessingSheet visible message="Confirmando agendamento..." />);
    expect(screen.getByText('Confirmando agendamento...')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    render(<PaymentProcessingSheet visible={false} />);
    expect(screen.queryByText('Processando seu pagamento...')).toBeNull();
  });

  it('cannot be dismissed while processing', () => {
    const { UNSAFE_getByType } = render(<PaymentProcessingSheet visible />);
    const modal = UNSAFE_getByType(Modal);
    expect(() => modal.props.onRequestClose()).not.toThrow();
    expect(screen.getByText('Processando seu pagamento...')).toBeTruthy();
    expect(screen.queryByLabelText('Fechar')).toBeNull();
  });
});
