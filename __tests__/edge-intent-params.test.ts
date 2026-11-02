import {
  buildConfirmParams,
  buildIntentParams,
  parseCreateIntentRequest,
  paymentIdempotencyKey,
  PIX_EXPIRES_AFTER_SECONDS,
  resolveAmountCents,
  RETURN_URL,
  summarizeIntent,
  type CreateIntentRequest,
} from '../supabase/functions/_shared/intentParams.ts';
import { parsePixNextAction } from '../supabase/functions/_shared/pixNextAction.ts';
import { HttpError } from '../supabase/functions/_shared/http.ts';

const bookingCard: CreateIntentRequest = {
  purpose: { kind: 'booking', appointmentId: 77 },
  method: 'card',
  cardId: 'pm_test',
  amountCents: 6500,
  idempotencyKey: 'booking:77',
};

const furaFilaPix: CreateIntentRequest = {
  purpose: { kind: 'fura_fila', merchantRef: 'm1' },
  method: 'pix',
  cardId: null,
  amountCents: 1500,
  idempotencyKey: 'chk_abc123def456',
};

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof HttpError ? err.code : 'not_http_error';
  }
  return undefined;
}

describe('parseCreateIntentRequest', () => {
  it('aceita booking com cartão', () => {
    expect(
      parseCreateIntentRequest({
        purpose: { kind: 'booking', appointmentId: 77 },
        method: 'card',
        cardId: 'pm_test',
        amountCents: 6500,
        idempotencyKey: 'booking:77',
      }),
    ).toEqual(bookingCard);
  });

  it('aceita fura-fila com Pix (sem cardId)', () => {
    expect(
      parseCreateIntentRequest({
        purpose: { kind: 'fura_fila', merchantRef: 'm1' },
        method: 'pix',
        amountCents: 1500,
        idempotencyKey: 'chk_abc123def456',
      }),
    ).toEqual(furaFilaPix);
  });

  it('rejeita entrada malformada com bad_request', () => {
    const base = { ...bookingCard } as Record<string, unknown>;
    expect(codeOf(() => parseCreateIntentRequest({ ...base, method: 'boleto' }))).toBe(
      'bad_request',
    );
    expect(codeOf(() => parseCreateIntentRequest({ ...base, cardId: undefined }))).toBe(
      'bad_request',
    );
    expect(codeOf(() => parseCreateIntentRequest({ ...base, amountCents: 65.5 }))).toBe(
      'bad_request',
    );
    expect(codeOf(() => parseCreateIntentRequest({ ...base, purpose: { kind: 'booking' } }))).toBe(
      'bad_request',
    );
    expect(
      codeOf(() =>
        parseCreateIntentRequest({ ...furaFilaPix, idempotencyKey: '' } as Record<string, unknown>),
      ),
    ).toBe('bad_request');
  });
});

describe('paymentIdempotencyKey', () => {
  it('booking usa booking:{id}, ignorando a chave do app', () => {
    expect(paymentIdempotencyKey({ ...bookingCard, idempotencyKey: 'outra' })).toBe('booking:77');
  });

  it('fura-fila usa a chave da tentativa de checkout', () => {
    expect(paymentIdempotencyKey(furaFilaPix)).toBe('chk_abc123def456');
  });
});

describe('resolveAmountCents', () => {
  it('booking usa o valor do servidor e confere o do app', () => {
    expect(
      resolveAmountCents(bookingCard, { serverAmountCents: 6500, furaFilaMaxCents: 20000 }),
    ).toBe(6500);
    expect(
      codeOf(() =>
        resolveAmountCents(bookingCard, { serverAmountCents: 7000, furaFilaMaxCents: 20000 }),
      ),
    ).toBe('amount_mismatch');
  });

  it('fura-fila valida a faixa', () => {
    expect(
      resolveAmountCents(furaFilaPix, { serverAmountCents: null, furaFilaMaxCents: 20000 }),
    ).toBe(1500);
    expect(
      codeOf(() =>
        resolveAmountCents(
          { ...furaFilaPix, amountCents: 20001 },
          { serverAmountCents: null, furaFilaMaxCents: 20000 },
        ),
      ),
    ).toBe('amount_out_of_range');
  });
});

describe('buildIntentParams', () => {
  it('booking com cartão: valor do servidor, customer, confirm, return_url, metadata; sem transfer', () => {
    const params = buildIntentParams({
      paymentId: 'pay_1',
      request: bookingCard,
      amountCents: 6500,
      customerId: 'cus_test',
    });
    expect(params).toEqual({
      amount: 6500,
      currency: 'brl',
      customer: 'cus_test',
      confirm: true,
      automatic_payment_methods: { enabled: true },
      return_url: RETURN_URL,
      payment_method: 'pm_test',
      metadata: { payment_id: 'pay_1', purpose: 'booking', appointment_id: '77' },
    });
    expect(params).not.toHaveProperty('transfer_data');
    expect(params).not.toHaveProperty('application_fee_amount');
    expect(params).not.toHaveProperty('payment_method_types');
  });

  it('Pix: payment_method_data pix com expiração de 15 min', () => {
    const params = buildIntentParams({
      paymentId: 'pay_2',
      request: furaFilaPix,
      amountCents: 1500,
      customerId: 'cus_test',
    });
    expect(params).toMatchObject({
      amount: 1500,
      payment_method_data: { type: 'pix' },
      payment_method_options: { pix: { expires_after_seconds: PIX_EXPIRES_AFTER_SECONDS } },
      return_url: RETURN_URL,
      metadata: { payment_id: 'pay_2', purpose: 'fura_fila', merchant_ref: 'm1' },
    });
    expect(PIX_EXPIRES_AFTER_SECONDS).toBe(900);
    expect(params).not.toHaveProperty('payment_method');
  });
});

describe('buildConfirmParams', () => {
  it('cartão: troca o payment_method no mesmo PI', () => {
    expect(buildConfirmParams({ ...bookingCard, cardId: 'pm_outro' })).toEqual({
      payment_method: 'pm_outro',
      return_url: RETURN_URL,
    });
  });

  it('Pix: reconfirma com payment_method_data pix', () => {
    expect(buildConfirmParams(furaFilaPix)).toEqual({
      payment_method_data: { type: 'pix' },
      payment_method_options: { pix: { expires_after_seconds: PIX_EXPIRES_AFTER_SECONDS } },
      return_url: RETURN_URL,
    });
  });
});

const pixNextAction = {
  type: 'pix_display_qr_code',
  pix_display_qr_code: {
    data: '00020126580014br.gov.bcb.pix0136teste5204000053039865802BR6304ABCD',
    image_url_png: 'https://qr.stripe.com/test.png',
    hosted_instructions_url: 'https://payments.stripe.com/pix/instructions/test',
    expires_at: 1762100000,
  },
};

describe('parsePixNextAction', () => {
  it('extrai copia e cola, imagem e expiração', () => {
    expect(parsePixNextAction(pixNextAction)).toEqual({
      copyPasteCode: pixNextAction.pix_display_qr_code.data,
      qrImageUrl: 'https://qr.stripe.com/test.png',
      hostedInstructionsUrl: 'https://payments.stripe.com/pix/instructions/test',
      expiresAt: new Date(1762100000 * 1000).toISOString(),
    });
  });

  it('next_action ausente ou de outro tipo lança', () => {
    expect(() => parsePixNextAction(null)).toThrow();
    expect(() => parsePixNextAction({ type: 'use_stripe_sdk' })).toThrow();
  });
});

describe('summarizeIntent', () => {
  it('cartão aprovado', () => {
    expect(
      summarizeIntent({ status: 'succeeded', client_secret: 'pi_secret', next_action: null }),
    ).toEqual({
      status: 'succeeded',
    });
  });

  it('3DS: requires_action com client_secret para o handleNextAction', () => {
    expect(
      summarizeIntent({
        status: 'requires_action',
        client_secret: 'pi_test_secret_x',
        next_action: { type: 'use_stripe_sdk' },
      }),
    ).toEqual({ status: 'requires_action', clientSecret: 'pi_test_secret_x' });
  });

  it('Pix: requires_action com o QR, sem client_secret', () => {
    expect(
      summarizeIntent({
        status: 'requires_action',
        client_secret: 'pi_s',
        next_action: pixNextAction,
      }),
    ).toEqual({ status: 'requires_action', pix: parsePixNextAction(pixNextAction) });
  });

  it('recusa: requires_payment_method com last_payment_error vira failed', () => {
    expect(
      summarizeIntent({
        status: 'requires_payment_method',
        client_secret: 'pi_s',
        next_action: null,
        last_payment_error: { code: 'card_declined', decline_code: 'generic_decline' },
      }),
    ).toEqual({ status: 'failed', failureCode: 'generic_decline' });
  });
});
