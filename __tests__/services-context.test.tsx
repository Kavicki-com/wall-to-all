import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import {
  ServicesProvider,
  useServices,
  useQueueService,
  useWalletService,
  useBookingPaymentService,
  useFeedService,
} from '../context/ServicesContext';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import { MockFeedService } from '../lib/services/mock/mockFeedService';
import { renderWithProviders } from './test-utils';

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

  it('useFeedService throws outside provider and creates a default MockFeedService inside', async () => {
    let categories: string[] | null = null;
    const FeedProbe = () => {
      const feed = useFeedService();
      React.useEffect(() => {
        feed.listCategories().then((c) => {
          categories = c;
        });
      }, [feed]);
      return <Text>feed-ok</Text>;
    };

    expect(() => render(<FeedProbe />)).toThrow(/ServicesProvider/);

    const { getByText } = render(
      <ServicesProvider>
        <FeedProbe />
      </ServicesProvider>,
    );
    expect(getByText('feed-ok')).toBeTruthy();
    await waitFor(() => expect(categories).toContain('Cabelo'));
  });

  it('renderWithProviders injects the same feed instance returned in the result', () => {
    let seen: unknown = null;
    const FeedProbe = () => {
      seen = useFeedService();
      return <Text>probe</Text>;
    };
    const result = renderWithProviders(<FeedProbe />);
    expect(seen).toBe(result.feed);

    const custom = new MockFeedService();
    const overridden = renderWithProviders(<FeedProbe />, { feed: custom });
    expect(seen).toBe(custom);
    expect(overridden.feed).toBe(custom);
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
