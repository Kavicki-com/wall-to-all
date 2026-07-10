import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { ServicesProvider } from '../context/ServicesContext';
import { MockQueueService } from '../lib/services/mock/mockQueueService';
import { MockWalletService } from '../lib/services/mock/mockWalletService';
import type { QueueService, WalletService } from '../lib/services/types';

/**
 * Harness compartilhado dos testes de tela da F1 (reusado pelas Tasks 15-23).
 *
 * `renderWithProviders(ui, options?)` envolve `ui` no `ServicesProvider` para
 * que `useQueueService()` / `useWalletService()` funcionem, injetando mocks com
 * **latência 0** (via a prop opcional `services` do provider). Assim as
 * operações resolvem numa microtask — nada de `setTimeout(300)` nem fake timers
 * —, mantendo os testes rápidos e determinísticos. Retorna o resultado do RTL
 * acrescido das instâncias injetadas (`queue`, `wallet`) para asserções diretas.
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
}

export type RenderWithProvidersResult = ReturnType<typeof render> & {
  queue: QueueService;
  wallet: WalletService;
};

// Serviços a descartar após cada teste — criados por default OU injetados. Um
// `MockQueueService`, p.ex., inicia um setInterval de simulação; sem dispose o
// Jest não encerra por handles abertos. Duck-typed: registra qualquer serviço
// com `dispose()`. Espelha o `afterEach(cleanup)` do próprio RTL.
interface Disposable {
  dispose: () => void;
}

const disposables = new Set<Disposable>();

function trackDisposable(service: QueueService | WalletService): void {
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
  const { queue: queueOverride, wallet: walletOverride, ...renderOptions } = options;
  const queue: QueueService = queueOverride ?? new MockQueueService({ latencyMs: 0 });
  const wallet: WalletService = walletOverride ?? new MockWalletService({ latencyMs: 0 });
  trackDisposable(queue);
  trackDisposable(wallet);

  // Referência estável do objeto de serviços (não recriado a cada render do wrapper).
  const services = { queue, wallet };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={services}>{children}</ServicesProvider>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return { ...result, queue, wallet };
}
