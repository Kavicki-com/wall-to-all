import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AppointmentSuccessModal from '../components/AppointmentSuccessModal';

describe('AppointmentSuccessModal', () => {
  it('shows the success copy and closes on Fechar', () => {
    const onClose = jest.fn();
    render(<AppointmentSuccessModal visible onClose={onClose} />);
    expect(screen.getByText('Agendamento concluído')).toBeTruthy();
    fireEvent.press(screen.getByText('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', () => {
    render(<AppointmentSuccessModal visible={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Agendamento concluído')).toBeNull();
  });
});
