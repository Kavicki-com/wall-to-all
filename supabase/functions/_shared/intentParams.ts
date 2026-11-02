/**
 * Regras puras da `payments-create-intent`: validação da entrada, valor
 * cobrado, parâmetros do PaymentIntent e resumo da resposta para o app.
 *
 * Spike (design § 16):
 *  - `payment_method_types` não existe mais; os métodos vêm do dashboard
 *    (`automatic_payment_methods`). Redirects ficam PERMITIDOS e todo PI leva
 *    `return_url`: o Pix conta como método com redirect, e assim o mesmo PI
 *    pode ser reconfirmado com cartão ou com Pix (cartão recusado, depois Pix).
 *  - Plataforma segura os fundos: sem `transfer_data` nem
 *    `application_fee_amount` (a taxa fica em `payments.platform_fee_cents`).
 */

import { HttpError } from './http.ts';
import { isPixNextAction, parsePixNextAction, type PixDisplay } from './pixNextAction.ts';
import { paymentStatusFromIntent, type PaymentStatus } from './statusMap.ts';

/** Deep link do app para o retorno de autenticação (3DS) e redirects. */
export const RETURN_URL = 'walltoall://stripe-redirect';
/** Validade do QR Pix: 15 min (`PIX_EXPIRY_MS` do mock). */
export const PIX_EXPIRES_AFTER_SECONDS = 900;

export type IntentPurpose =
  | { kind: 'booking'; appointmentId: number }
  | { kind: 'fura_fila'; merchantRef: string };

export interface CreateIntentRequest {
  purpose: IntentPurpose;
  method: 'card' | 'pix';
  /** `pm_...` do cartão salvo; obrigatório no cartão, null no Pix. */
  cardId: string | null;
  /** Valor que o app mostrou (booking: só conferido; fura-fila: cobrado). */
  amountCents: number;
  /** Fura-fila: chave da tentativa de checkout. Booking: ignorada. */
  idempotencyKey: string;
}

function bad(message: string): never {
  throw new HttpError(400, 'bad_request', message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCreateIntentRequest(body: Record<string, unknown>): CreateIntentRequest {
  const { purpose, method, cardId, amountCents, idempotencyKey } = body;

  let parsedPurpose: IntentPurpose;
  if (isObject(purpose) && purpose.kind === 'booking') {
    const id = purpose.appointmentId;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) bad('appointmentId inválido.');
    parsedPurpose = { kind: 'booking', appointmentId: id };
  } else if (isObject(purpose) && purpose.kind === 'fura_fila') {
    const ref = purpose.merchantRef;
    if (typeof ref !== 'string' || ref.length === 0 || ref.length > 64)
      bad('merchantRef inválido.');
    parsedPurpose = { kind: 'fura_fila', merchantRef: ref };
  } else {
    bad('purpose inválido.');
  }

  if (method !== 'card' && method !== 'pix') bad('method inválido.');
  if (method === 'card' && (typeof cardId !== 'string' || !cardId.startsWith('pm_'))) {
    bad('cardId inválido.');
  }
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0) {
    bad('amountCents inválido.');
  }
  if (
    typeof idempotencyKey !== 'string' ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 100
  ) {
    bad('idempotencyKey inválida.');
  }

  return {
    purpose: parsedPurpose,
    method,
    cardId: method === 'card' ? (cardId as string) : null,
    amountCents,
    idempotencyKey,
  };
}

/** Chave da linha em `payments`: uma cobrança por agendamento, uma por tentativa de fura-fila. */
export function paymentIdempotencyKey(request: CreateIntentRequest): string {
  return request.purpose.kind === 'booking'
    ? `booking:${request.purpose.appointmentId}`
    : request.idempotencyKey;
}

export interface AmountRules {
  /** Booking: `services.price` em centavos. Fura-fila: null (preço mora na fixture). */
  serverAmountCents: number | null;
  furaFilaMaxCents: number;
}

export function resolveAmountCents(request: CreateIntentRequest, rules: AmountRules): number {
  if (request.purpose.kind === 'booking') {
    if (rules.serverAmountCents === null) throw new Error('Booking sem valor do servidor.');
    if (rules.serverAmountCents !== request.amountCents) {
      throw new HttpError(409, 'amount_mismatch', 'O preço do serviço mudou.');
    }
    return rules.serverAmountCents;
  }
  if (request.amountCents > rules.furaFilaMaxCents) {
    throw new HttpError(422, 'amount_out_of_range');
  }
  return request.amountCents;
}

function methodParams(request: CreateIntentRequest) {
  if (request.method === 'card') {
    return { payment_method: request.cardId as string };
  }
  return {
    payment_method_data: { type: 'pix' as const },
    payment_method_options: { pix: { expires_after_seconds: PIX_EXPIRES_AFTER_SECONDS } },
  };
}

function metadataFor(paymentId: string, purpose: IntentPurpose): Record<string, string> {
  return purpose.kind === 'booking'
    ? { payment_id: paymentId, purpose: 'booking', appointment_id: String(purpose.appointmentId) }
    : { payment_id: paymentId, purpose: 'fura_fila', merchant_ref: purpose.merchantRef };
}

/** Criação já confirmando (primeira tentativa). */
export function buildIntentParams(input: {
  paymentId: string;
  request: CreateIntentRequest;
  amountCents: number;
  customerId: string;
}) {
  return {
    amount: input.amountCents,
    currency: 'brl' as const,
    customer: input.customerId,
    confirm: true as const,
    automatic_payment_methods: { enabled: true as const },
    return_url: RETURN_URL,
    ...methodParams(input.request),
    metadata: metadataFor(input.paymentId, input.request.purpose),
  };
}

/** Nova tentativa no mesmo PI (outro cartão, ou troca para Pix). */
export function buildConfirmParams(request: CreateIntentRequest) {
  return { ...methodParams(request), return_url: RETURN_URL };
}

/** Recorte do PaymentIntent que o resumo lê. */
export interface IntentShape {
  status: string;
  client_secret: string | null;
  next_action: unknown;
  last_payment_error?: { code?: string | null; decline_code?: string | null } | null;
}

export interface IntentSummary {
  status: PaymentStatus;
  /** Só para 3DS de cartão (`handleNextAction` no app). */
  clientSecret?: string;
  pix?: PixDisplay;
  failureCode?: string;
}

/**
 * Status informado ao app logo após a chamada. É só uma dica: "aprovado" na
 * UI continua vindo de `payments.status`, gravado pelo webhook.
 */
export function summarizeIntent(intent: IntentShape): IntentSummary {
  if (intent.status === 'requires_payment_method' && intent.last_payment_error) {
    const err = intent.last_payment_error;
    return { status: 'failed', failureCode: err.decline_code ?? err.code ?? 'payment_failed' };
  }
  const status = paymentStatusFromIntent(intent.status);
  if (status !== 'requires_action') return { status };
  if (isPixNextAction(intent.next_action)) {
    return { status, pix: parsePixNextAction(intent.next_action) };
  }
  if (!intent.client_secret) throw new Error('PaymentIntent em requires_action sem client_secret.');
  return { status, clientSecret: intent.client_secret };
}
