import type { PaymentStatus } from '../services/types';

/**
 * Espera o banco dizer que a cobrança terminou (design § 8.3): o app nunca
 * considera pago só pela resposta da Stripe, e o webhook pode levar alguns
 * segundos. Consulta `getStatus` a cada `intervalMs` até um estado final.
 *
 * - `succeeded`, `failed`, `canceled` e `refunded` encerram.
 * - Sem estado final até `timeoutMs`: `'timeout'` (a UI mostra "em análise").
 * - `signal` abortado (tela fechada): `'aborted'` e o polling para.
 * - Erro de rede numa consulta não encerra: tenta de novo no próximo ciclo.
 */

export type SettledResult =
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'timeout'
  | 'aborted';

export interface AwaitPaymentOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const FINAL: ReadonlySet<PaymentStatus> = new Set(['succeeded', 'failed', 'canceled', 'refunded']);

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done);
  });
}

export async function awaitPaymentSettled(
  getStatus: () => Promise<PaymentStatus>,
  { intervalMs = 2000, timeoutMs = 60000, signal }: AwaitPaymentOptions = {},
): Promise<SettledResult> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (signal?.aborted) return 'aborted';
    try {
      const status = await getStatus();
      if (FINAL.has(status)) return status as SettledResult;
    } catch {
      // rede instável: a próxima consulta decide
    }
    if (signal?.aborted) return 'aborted';
    if (Date.now() + intervalMs > deadline) return 'timeout';
    await wait(intervalMs, signal);
  }
}
