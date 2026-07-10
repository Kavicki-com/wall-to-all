import { useEffect, useMemo, useState } from 'react';
import { useQueueService } from '../../context/ServicesContext';
import type { NearbyMerchant } from '../services/types';
import { SP_CENTER } from '../aqui-agora/constants';

/**
 * Estado de carregamento dos dados "Aqui e Agora". Convenção compartilhada pelas
 * telas F1 (e pelo `ResultsSheetStatus`): `loading` mostra um indicador, `error`
 * uma mensagem curta, `ready` os dados carregados.
 */
export type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Carrega os merchants próximos a partir do `SP_CENTER` via `QueueService`
 * (`useQueueService`, nunca instanciado aqui). Encapsula o `useEffect` com guarda
 * de cancelamento (`active`) e a máquina de estados `loading → ready | error`
 * antes usada in-line em cada tela "Aqui e Agora". Em erro, a lista volta vazia.
 */
export function useNearbyMerchants(): { merchants: NearbyMerchant[]; status: LoadStatus } {
  const queueService = useQueueService();
  const [merchants, setMerchants] = useState<NearbyMerchant[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    queueService
      .getNearbyMerchants(SP_CENTER)
      .then((result) => {
        if (!active) return;
        setMerchants(result);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setMerchants([]);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [queueService]);

  return { merchants, status };
}

/**
 * Localiza um merchant pelo `id` sobre a lista de `useNearbyMerchants`. Enquanto a
 * lista carrega (ou falha), repassa esse status e mantém `merchant` nulo. Quando a
 * lista está pronta, faz `find(m => m.id === id)`: encontrado → `ready`; um id
 * ausente/desconhecido → `error` (mesma semântica das telas de perfil e fura-fila,
 * em que um id inválido cai na tela de erro).
 */
export function useMerchant(id: string | undefined): {
  merchant: NearbyMerchant | null;
  status: LoadStatus;
} {
  const { merchants, status } = useNearbyMerchants();

  return useMemo<{ merchant: NearbyMerchant | null; status: LoadStatus }>(() => {
    if (status !== 'ready') {
      return { merchant: null, status };
    }
    const found = merchants.find((m) => m.id === id) ?? null;
    return { merchant: found, status: found ? 'ready' : 'error' };
  }, [merchants, status, id]);
}
