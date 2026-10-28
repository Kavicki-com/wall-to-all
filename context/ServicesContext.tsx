import React, { createContext, useContext, useEffect, useMemo, useRef, ReactNode } from 'react';
import type { QiService, QueueService, WalletService } from '../lib/services/types';
import {
  MockQueueService,
  SIMULATED_LATENCY_MS as QUEUE_LATENCY_MS,
} from '../lib/services/mock/mockQueueService';
import {
  MockWalletService,
  SIMULATED_LATENCY_MS as WALLET_LATENCY_MS,
} from '../lib/services/mock/mockWalletService';
import {
  MockQiService,
  SIMULATED_LATENCY_MS as QI_LATENCY_MS,
} from '../lib/services/mock/mockQiService';

interface ServicesContextType {
  queue: QueueService;
  wallet: WalletService;
  qi: QiService;
}

// Default undefined + guard no hook: consumir fora do provider deve lançar.
const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

interface ServicesProviderProps {
  children: ReactNode;
  /**
   * Injeta serviços prontos, sobrepondo os singletons criados internamente.
   * Usado pelos testes (`renderWithProviders`) para passar mocks com latência 0
   * — rápidos e determinísticos. Omitido no app real, onde o provider cria as
   * instâncias default com `SIMULATED_LATENCY_MS`. Serviços injetados pertencem
   * a quem os injeta: o provider só descarta (dispose) a fila que ELE mesmo cria.
   */
  services?: ServicesContextType;
}

/**
 * Injeta as implementações de serviço (fila, carteira e QI) na árvore de
 * componentes. É o ÚNICO lugar que opta pela latência simulada realista:
 * instancia os mocks com `SIMULATED_LATENCY_MS` para dar ao app rodando delays
 * de rede plausíveis, enquanto os testes unitários constroem os mocks direto
 * com latência default 0 e permanecem rápidos.
 *
 * As instâncias default são criadas UMA vez via useRef (estáveis entre
 * re-renders) e o MockQueueService é descartado (dispose) no unmount para
 * limpar seu setInterval. Quando `services` é injetado, nenhum singleton é
 * criado e o dispose no unmount é um no-op (a fila injetada não é do provider).
 */
export const ServicesProvider: React.FC<ServicesProviderProps> = ({ children, services }) => {
  const queueRef = useRef<MockQueueService | null>(null);
  const walletRef = useRef<MockWalletService | null>(null);
  const qiRef = useRef<MockQiService | null>(null);

  // NOTA: as instâncias default são criadas aqui no render (lazy via ref) e o
  // dispose() da fila roda no cleanup do useEffect abaixo. Esse acoplamento
  // render↔effect é seguro porque StrictMode NÃO está habilitado neste app
  // (Expo Router não o ativa por padrão). Se StrictMode for adotado, mover a
  // criação para dentro do useEffect (lifecycle simétrico) para evitar segurar
  // uma fila já disposed após o ciclo mount→unmount→mount.
  // Só cria os singletons quando nenhum serviço é injetado.
  if (!services && queueRef.current === null) {
    queueRef.current = new MockQueueService({ latencyMs: QUEUE_LATENCY_MS });
    walletRef.current = new MockWalletService({ latencyMs: WALLET_LATENCY_MS });
    // O MockQiService não tem timers persistentes — dispensa dispose no unmount.
    qiRef.current = new MockQiService({ latencyMs: QI_LATENCY_MS });
  }

  useEffect(() => {
    return () => {
      // Descarta apenas a fila criada internamente; serviços injetados são
      // gerenciados por quem os injetou (queueRef fica null nesse caso).
      queueRef.current?.dispose();
    };
  }, []);

  const value = useMemo<ServicesContextType>(
    () =>
      services ?? { queue: queueRef.current!, wallet: walletRef.current!, qi: qiRef.current! },
    [services],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
};

/** Retorna `{ queue, wallet, qi }`. Lança se usado fora do ServicesProvider. */
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

/** Atalho para o QiService. Herda o guard de useServices. */
export const useQiService = (): QiService => useServices().qi;
