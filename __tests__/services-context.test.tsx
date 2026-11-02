import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  ServicesProvider,
  useServices,
  useQueueService,
  useWalletService,
  useBookingPaymentService,
} from '../context/ServicesContext';
import { MockQueueService } from '../lib/services/mock/mockQueueService';

const Probe = () => {
  const { queue, wallet } = useServices();
  return <Text>{queue && wallet ? 'ok' : 'missing'}</Text>;
};

describe('ServicesProvider', () => {
  it('provides queue and wallet services', () => {
    const { getByText } = render(
      <ServicesProvider>
        <Probe />
      </ServicesProvider>,
    );
    expect(getByText('ok')).toBeTruthy();
  });

  it('useServices throws outside provider', () => {
    const bad = () => render(<Probe />);
    expect(bad).toThrow(/ServicesProvider/);
  });

  it('useQueueService and useWalletService return the same instances as useServices', () => {
    let sameQueue = false;
    let sameWallet = false;

    const InstanceProbe = () => {
      const { queue, wallet } = useServices();
      const queueOnly = useQueueService();
      const walletOnly = useWalletService();
      sameQueue = queue === queueOnly;
      sameWallet = wallet === walletOnly;
      return <Text>done</Text>;
    };

    render(
      <ServicesProvider>
        <InstanceProbe />
      </ServicesProvider>,
    );

    expect(sameQueue).toBe(true);
    expect(sameWallet).toBe(true);
  });

  it('useBookingPaymentService throws outside provider and resolves inside', () => {
    const BookingProbe = () => {
      const booking = useBookingPaymentService();
      return <Text>{typeof booking.getPayment === 'function' ? 'booking-ok' : 'missing'}</Text>;
    };

    expect(() => render(<BookingProbe />)).toThrow(/ServicesProvider/);

    const { getByText } = render(
      <ServicesProvider>
        <BookingProbe />
      </ServicesProvider>,
    );
    expect(getByText('booking-ok')).toBeTruthy();
  });

  it('disposes the queue service on unmount', () => {
    const disposeSpy = jest.spyOn(MockQueueService.prototype, 'dispose');
    const { unmount } = render(
      <ServicesProvider>
        <Probe />
      </ServicesProvider>,
    );
    expect(disposeSpy).not.toHaveBeenCalled();
    unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    disposeSpy.mockRestore();
  });
});
