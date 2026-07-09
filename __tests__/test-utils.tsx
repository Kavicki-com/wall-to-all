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

// Filas criadas internamente por `renderWithProviders` (não as sobreposições do
// chamador). Cada `MockQueueService` inicia um setInterval de simulação; sem
// dispose o Jest não encerra por conta de handles abertos. Descartamos todas
// após cada teste — espelhando o `afterEach(cleanup)` do próprio RTL.
const createdQueues = new Set<MockQueueService>();

if (typeof afterEach === 'function') {
  afterEach(() => {
    createdQueues.forEach((queue) => queue.dispose());
    createdQueues.clear();
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { queue: queueOverride, wallet: walletOverride, ...renderOptions } = options;
  const createdQueue = queueOverride ? null : new MockQueueService({ latencyMs: 0 });
  if (createdQueue) createdQueues.add(createdQueue);
  const queue: QueueService = queueOverride ?? createdQueue!;
  const wallet: WalletService = walletOverride ?? new MockWalletService({ latencyMs: 0 });

  // Referência estável do objeto de serviços (não recriado a cada render do wrapper).
  const services = { queue, wallet };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={services}>{children}</ServicesProvider>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return { ...result, queue, wallet };
}
