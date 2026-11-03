import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { ServicesProvider } from '../context/ServicesContext';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import { MockWalletService } from '../lib/services/mock/mockWalletService';
import { MockQiService } from '../lib/services/mock/mockQiService';
import type { QiService, QueueService, WalletService } from '../lib/services/types';
import { MockBookingPaymentService } from '../lib/services/mock/mockBookingPaymentService';
import type { BookingPaymentService } from '../lib/services/bookingTypes';
import { MockFeedService } from '../lib/services/mock/mockFeedService';
import type { FeedService } from '../lib/services/feedTypes';
import { MockSubscriptionService } from '../lib/services/mock/mockSubscriptionService';
import type { SubscriptionService } from '../lib/services/subscriptionTypes';

/**
 * Harness compartilhado dos testes de tela da F1 (reusado pelas Tasks 15-23).
 *
 * `renderWithProviders(ui, options?)` envolve `ui` no `ServicesProvider` para
 * que `useQueueService()` / `useWalletService()` / `useQiService()` funcionem,
 * injetando mocks com **latência 0** (via a prop opcional `services` do
 * provider). Assim as operações resolvem numa microtask — nada de
 * `setTimeout(300)` nem fake timers —, mantendo os testes rápidos e
 * determinísticos. Retorna o resultado do RTL acrescido das instâncias
 * injetadas (`queue`, `wallet`, `qi`) para asserções diretas.
 *
 * Após cada teste, o harness descarta (dispose) QUALQUER serviço que exponha um
 * método `dispose()` — tanto os criados por default quanto as sobreposições
 * (`options.queue` / `options.wallet`) passadas pelo chamador. Isso limpa, por
 * exemplo, o setInterval de simulação do `MockQueueService` (senão o Jest não
 * encerra por conta de handles abertos).
 *
 * IMPORTANTE — este módulo NÃO chama `jest.mock('expo-router', ...)`. `jest.mock`
 * é içado por arquivo e precisa viver no escopo do módulo de CADA teste. Todo
 * arquivo de teste que renderiza uma tela que consome `useRouter()` DEVE
 * declarar, no topo do módulo (o prefixo `mock` é exigido pelo hoisting do Jest):
 *
 *   const mockPush = jest.fn();
 *   jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
 */
export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Sobrepõe o QueueService injetado (default: `MockQueueService` latência 0). */
  queue?: QueueService;
  /** Sobrepõe o WalletService injetado (default: `MockWalletService` latência 0). */
  wallet?: WalletService;
  /** Sobrepõe o QiService injetado (default: `MockQiService` latência 0). */
  qi?: QiService;
  /** Sobrepõe o BookingPaymentService injetado (default: `MockBookingPaymentService` latência 0). */
  booking?: BookingPaymentService;
  /** Sobrepõe o FeedService injetado (default: `MockFeedService` latência 0). */
  feed?: FeedService;
  /** Sobrepõe o SubscriptionService injetado (default: `MockSubscriptionService` latência 0). */
  subscription?: SubscriptionService;
}

export type RenderWithProvidersResult = ReturnType<typeof render> & {
  queue: QueueService;
  wallet: WalletService;
  qi: QiService;
  booking: BookingPaymentService;
  feed: FeedService;
  subscription: SubscriptionService;
};

// Serviços a descartar após cada teste — criados por default OU injetados. Um
// `MockQueueService`, p.ex., inicia um setInterval de simulação; sem dispose o
// Jest não encerra por handles abertos. Duck-typed: registra qualquer serviço
// com `dispose()`. Espelha o `afterEach(cleanup)` do próprio RTL.
interface Disposable {
  dispose: () => void;
}

const disposables = new Set<Disposable>();

function trackDisposable(
  service:
    | QueueService
    | WalletService
    | QiService
    | BookingPaymentService
    | FeedService
    | SubscriptionService,
): void {
  if (typeof (service as Partial<Disposable>).dispose === 'function') {
    disposables.add(service as unknown as Disposable);
  }
}

if (typeof afterEach === 'function') {
  afterEach(() => {
    disposables.forEach((service) => service.dispose());
    disposables.clear();
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const {
    queue: queueOverride,
    wallet: walletOverride,
    qi: qiOverride,
    booking: bookingOverride,
    feed: feedOverride,
    subscription: subscriptionOverride,
    ...renderOptions
  } = options;
  const queue: QueueService = queueOverride ?? new MockQueueService({ latencyMs: 0 });
  const wallet: WalletService = walletOverride ?? new MockWalletService({ latencyMs: 0 });
  const qi: QiService = qiOverride ?? new MockQiService({ latencyMs: 0 });
  const booking: BookingPaymentService =
    bookingOverride ?? new MockBookingPaymentService({ latencyMs: 0 });
  trackDisposable(queue);
  trackDisposable(wallet);
  trackDisposable(qi); // no-op hoje (MockQiService não tem dispose) — duck-typed p/ futuro.
  trackDisposable(booking); // no-op hoje, idem.
  const feed: FeedService = feedOverride ?? new MockFeedService({ latencyMs: 0 });
  trackDisposable(feed); // no-op hoje, idem.
  const subscription: SubscriptionService =
    subscriptionOverride ?? new MockSubscriptionService({ latencyMs: 0 });
  trackDisposable(subscription); // no-op hoje, idem.

  // Referência estável do objeto de serviços (não recriado a cada render do wrapper).
  const services = { queue, wallet, qi, booking, feed, subscription };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={services}>{children}</ServicesProvider>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return { ...result, queue, wallet, qi, booking, feed, subscription };
}
