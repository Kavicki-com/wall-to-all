import React, { createContext, useContext, useEffect, useMemo, useRef, ReactNode } from 'react';
import type { QueueService, WalletService } from '../lib/services/types';
import {
  MockQueueService,
  SIMULATED_LATENCY_MS as QUEUE_LATENCY_MS,
} from '../lib/services/mock/mockQueueService';
import {
  MockWalletService,
  SIMULATED_LATENCY_MS as WALLET_LATENCY_MS,
} from '../lib/services/mock/mockWalletService';

interface ServicesContextType {
  queue: QueueService;
  wallet: WalletService;
}

// Default undefined + guard no hook: consumir fora do provider deve lançar.
const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

/**
 * Injeta as implementações de serviço (fila e carteira) na árvore de
 * componentes. É o ÚNICO lugar que opta pela latência simulada realista:
 * instancia os mocks com `SIMULATED_LATENCY_MS` para dar ao app rodando delays
 * de rede plausíveis, enquanto os testes unitários constroem os mocks direto
 * com latência default 0 e permanecem rápidos.
 *
 * As instâncias são criadas UMA vez via useRef (estáveis entre re-renders) e o
 * MockQueueService é descartado (dispose) no unmount para limpar seu setInterval.
 */
export const ServicesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queueRef = useRef<MockQueueService | null>(null);
  const walletRef = useRef<MockWalletService | null>(null);

  if (queueRef.current === null) {
    queueRef.current = new MockQueueService({ latencyMs: QUEUE_LATENCY_MS });
  }
  if (walletRef.current === null) {
    walletRef.current = new MockWalletService({ latencyMs: WALLET_LATENCY_MS });
  }

  useEffect(() => {
    return () => {
      queueRef.current?.dispose();
    };
  }, []);

  const value = useMemo<ServicesContextType>(
    () => ({ queue: queueRef.current!, wallet: walletRef.current! }),
    [],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
};

/** Retorna `{ queue, wallet }`. Lança se usado fora do ServicesProvider. */
export const useServices = (): ServicesContextType => {
  const context = useContext(ServicesContext);
  if (context === undefined) {
    throw new Error('useServices deve ser usado dentro de um ServicesProvider');
  }
  return context;
};

/** Atalho para o QueueService. Herda o guard de useServices. */
export const useQueueService = (): QueueService => useServices().queue;

/** Atalho para o WalletService. Herda o guard de useServices. */
export const useWalletService = (): WalletService => useServices().wallet;
