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
  useSubscriptionService,
  useProfileStampsService,
} from '../context/ServicesContext';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import { MockFeedService } from '../lib/services/mock/mockFeedService';
import { renderWithProviders } from './test-utils';
import { MockWalletService } from '../lib/services/mock/mockWalletService';
import { StripeWalletService } from '../lib/services/stripe/stripeWalletService';
import { MockBookingPaymentService } from '../lib/services/mock/mockBookingPaymentService';
import { StripeBookingPaymentService } from '../lib/services/stripe/stripeBookingPaymentService';
import { getStripeConfig } from '../lib/payments/stripeConfig';

// O StripeWalletService importa o cliente real; aqui só a classe importa.
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/payments/stripeConfig', () => ({
  getStripeConfig: jest.fn(() => ({ provider: 'mock' })),
}));
const mockedGetStripeConfig = getStripeConfig as jest.MockedFunction<typeof getStripeConfig>;

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

  it('useSubscriptionService throws outside provider and resolves inside', async () => {
    let planName: string | null = null;
    const SubscriptionProbe = () => {
      const subscription = useSubscriptionService();
      React.useEffect(() => {
        subscription.getPlan().then((p) => {
          planName = p.name;
        });
      }, [subscription]);
      return <Text>subscription-ok</Text>;
    };

    expect(() => render(<SubscriptionProbe />)).toThrow(/ServicesProvider/);

    const { getByText } = render(
      <ServicesProvider>
        <SubscriptionProbe />
      </ServicesProvider>,
    );
    expect(getByText('subscription-ok')).toBeTruthy();
    await waitFor(() => expect(planName).toBe('Wall to All Premium'));

    let seen: unknown = null;
    const SameProbe = () => {
      seen = useSubscriptionService();
      return <Text>probe</Text>;
    };
    const result = renderWithProviders(<SameProbe />);
    expect(seen).toBe(result.subscription);
  });

  it('useProfileStampsService throws outside provider and resolves inside', async () => {
    let count: number | null = null;
    const StampsProbe = () => {
      const stamps = useProfileStampsService();
      React.useEffect(() => {
        stamps.getStamps().then((s) => {
          count = s.length;
        });
      }, [stamps]);
      return <Text>stamps-ok</Text>;
    };

    expect(() => render(<StampsProbe />)).toThrow(/ServicesProvider/);

    const { getByText } = render(
      <ServicesProvider>
        <StampsProbe />
      </ServicesProvider>,
    );
    expect(getByText('stamps-ok')).toBeTruthy();
    await waitFor(() => expect(count).toBe(2));

    let seen: unknown = null;
    const SameProbe = () => {
      seen = useProfileStampsService();
      return <Text>probe</Text>;
    };
    const result = renderWithProviders(<SameProbe />);
    expect(seen).toBe(result.stamps);
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

  describe('seleção da carteira por provedor (F8)', () => {
    const WalletProbe = ({ onWallet }: { onWallet: (w: unknown) => void }) => {
      onWallet(useWalletService());
      return <Text>wallet</Text>;
    };

    afterEach(() => mockedGetStripeConfig.mockReturnValue({ provider: 'mock' }));

    it('sem configuração Stripe usa o MockWalletService', () => {
      let wallet: unknown;
      render(
        <ServicesProvider>
          <WalletProbe onWallet={(w) => (wallet = w)} />
        </ServicesProvider>,
      );
      expect(wallet).toBeInstanceOf(MockWalletService);
    });

    it('agendamento: mock por default e Stripe com provider stripe', () => {
      const BookingProbe = ({ onBooking }: { onBooking: (b: unknown) => void }) => {
        onBooking(useBookingPaymentService());
        return <Text>booking</Text>;
      };
      let booking: unknown;
      const first = render(
        <ServicesProvider>
          <BookingProbe onBooking={(b) => (booking = b)} />
        </ServicesProvider>,
      );
      expect(booking).toBeInstanceOf(MockBookingPaymentService);
      first.unmount();

      mockedGetStripeConfig.mockReturnValue({ provider: 'stripe', publishableKey: 'pk_test_x' });
      render(
        <ServicesProvider>
          <BookingProbe onBooking={(b) => (booking = b)} />
        </ServicesProvider>,
      );
      expect(booking).toBeInstanceOf(StripeBookingPaymentService);
    });

    it('com provider stripe usa o StripeWalletService', () => {
      mockedGetStripeConfig.mockReturnValue({ provider: 'stripe', publishableKey: 'pk_test_x' });
      let wallet: unknown;
      render(
        <ServicesProvider>
          <WalletProbe onWallet={(w) => (wallet = w)} />
        </ServicesProvider>,
      );
      expect(wallet).toBeInstanceOf(StripeWalletService);
    });
  });
});
