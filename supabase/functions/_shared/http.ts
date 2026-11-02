/**
 * Respostas JSON e erros com código das Edge Functions de pagamento.
 *
 * Contrato com o app (`lib/services/stripe/edgeClient.ts`): sucesso devolve o
 * corpo JSON direto; erro devolve `{ error: { code, message } }` com status
 * HTTP. O app traduz `code` para mensagem pt-BR; `message` é só diagnóstico.
 * Sem `Deno.*`: roda igual no jest.
 */

import { corsHeaders } from './cors.ts';

export type ErrorCode =
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
  | 'internal';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(err: unknown, logTag: string): Response {
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
  // Erro da Stripe (StripeError): repassa o código, nunca a requisição.
  const stripeErr = err as { type?: string; code?: string; message?: string } | null;
  if (stripeErr?.type?.startsWith('Stripe')) {
    console.error(`[${logTag}] stripe:`, stripeErr.type, stripeErr.code, stripeErr.message);
    if (stripeErr.code === 'resource_missing') {
      return json({ error: { code: 'not_found', message: 'resource_missing' } }, 404);
    }
    if (stripeErr.type === 'StripeCardError') {
      return json(
        { error: { code: 'card_declined', message: stripeErr.code ?? 'card_error' } },
        402,
      );
    }
    return json(
      { error: { code: 'provider_error', message: stripeErr.code ?? stripeErr.type } },
      502,
    );
  }
  console.error(`[${logTag}] erro interno:`, err);
  return json({ error: { code: 'internal', message: 'Erro interno.' } }, 500);
}

/** Envelopa o handler: preflight CORS e tradução de erros. */
export function handle(
  logTag: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    try {
      return await handler(req);
    } catch (err) {
      return errorResponse(err, logTag);
    }
  };
}

/** Corpo JSON como objeto; corpo vazio vira `{}`. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // cai no erro abaixo
  }
  throw new HttpError(400, 'bad_request', 'Corpo JSON inválido.');
}
