/**
 * Chamada às Edge Functions de pagamento (F8). Contrato com
 * `supabase/functions/_shared/http.ts`: sucesso devolve o corpo JSON direto;
 * erro devolve `{ error: { code, message } }` com status HTTP. Aqui o `code`
 * vira `PaymentsApiError` com mensagem pt-BR pronta para a UI; o `message` do
 * servidor é só diagnóstico e nunca chega à tela.
 */

import { supabase } from '../../supabase';

export type PaymentsErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'bad_request'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'amount_mismatch'
  | 'amount_out_of_range'
  | 'invalid_state'
  | 'card_not_found'
  | 'card_declined'
  | 'unsupported_card_brand'
  | 'setup_not_succeeded'
  | 'insufficient_balance'
  | 'below_minimum'
  | 'payout_account_inactive'
  | 'provider_error'
  | 'internal'
  | 'network'
  | 'timeout';

const MESSAGES: Record<PaymentsErrorCode, string> = {
  unauthorized: 'Sua sessão expirou. Entre de novo para continuar.',
  forbidden: 'Você não tem permissão para esta operação.',
  bad_request: 'Não foi possível processar o pedido. Confira os dados e tente de novo.',
  not_found: 'Não encontramos o que você procurava.',
  method_not_allowed: 'Operação não suportada.',
  conflict: 'Este pedido conflita com um anterior. Recarregue e tente de novo.',
  amount_mismatch: 'O valor mudou desde a primeira tentativa. Recarregue e tente de novo.',
  amount_out_of_range: 'Valor fora do permitido.',
  invalid_state: 'Este pagamento não pode mais ser alterado.',
  card_not_found: 'Cartão não encontrado. Escolha outro cartão.',
  card_declined: 'Cartão recusado. Tente outro cartão.',
  unsupported_card_brand: 'Bandeira de cartão não aceita.',
  setup_not_succeeded: 'Não foi possível validar o cartão. Tente de novo.',
  insufficient_balance: 'Saldo insuficiente para o saque.',
  below_minimum: 'Valor abaixo do mínimo para saque.',
  payout_account_inactive: 'Ative seus recebimentos para poder sacar.',
  provider_error: 'O serviço de pagamento não respondeu. Tente de novo em instantes.',
  internal: 'Algo deu errado. Tente de novo em instantes.',
  network: 'Sem conexão. Confira sua internet e tente de novo.',
  timeout:
    'Ainda não confirmamos o pagamento. Tente de novo em instantes; você não será cobrado duas vezes.',
};

export class PaymentsApiError extends Error {
  constructor(
    readonly code: PaymentsErrorCode,
    /** Status HTTP da função; 0 quando a requisição nem chegou. */
    readonly status = 0,
  ) {
    super(MESSAGES[code]);
    this.name = 'PaymentsApiError';
  }
}

function isKnownCode(code: unknown): code is PaymentsErrorCode {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

/** Erro do `functions.invoke` -> `PaymentsApiError`. */
async function toPaymentsError(error: unknown): Promise<PaymentsApiError> {
  const context = (error as { context?: { status?: number; json?: () => Promise<unknown> } } | null)
    ?.context;
  if (context && typeof context.json === 'function') {
    const status = typeof context.status === 'number' ? context.status : 0;
    try {
      const body = (await context.json()) as { error?: { code?: unknown } } | null;
      const code = body?.error?.code;
      return new PaymentsApiError(isKnownCode(code) ? code : 'internal', status);
    } catch {
      return new PaymentsApiError(status === 401 ? 'unauthorized' : 'internal', status);
    }
  }
  // FunctionsFetchError / FunctionsRelayError: a requisição não chegou à função.
  return new PaymentsApiError('network');
}

export interface InvokeOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
}

export async function invokeEdge<T>(
  name: string,
  { method = 'POST', body }: InvokeOptions = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    name,
    body === undefined ? { method } : { method, body },
  );
  if (error) throw await toPaymentsError(error);
  return data as T;
}
