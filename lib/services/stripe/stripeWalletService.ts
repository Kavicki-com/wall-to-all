/**
 * `WalletService` com pagamentos reais (Stripe em test mode, F8).
 *
 * - Cobrança: `payments-create-intent`; 3DS pelo SDK; "aprovado" só quando
 *   `payments.status = 'succeeded'` no banco (gravado pelo webhook), nunca pela
 *   resposta da função (design § 8.3).
 * - Cartões e conta de recebimento: Edge Functions (`payments-cards`,
 *   `connect-onboarding`).
 * - Chaves Pix, extrato e saldo: leitura direta com RLS (`my_pix_keys`,
 *   `payments`, `ledger_entries`, `merchant_balance_cents`).
 * - Saque: `wallet-withdraw`. Pelo § 16 do design o saque vira transfer para a
 *   conta Stripe do lojista, na hora; o payout ao banco segue o calendário da
 *   Stripe.
 */

import { handleNextAction } from '@stripe/stripe-react-native';
import { supabase } from '../../supabase';
import { awaitPaymentSettled } from '../../payments/awaitPaymentSettled';
import { newCheckoutKey } from '../../payments/checkoutKey';
import { computeWithdrawQuote } from '../mock/withdrawQuote';
import type {
  PaymentCard,
  PaymentRequestContext,
  PaymentStatus,
  PayoutAccountStatus,
  PixCharge,
  PixKey,
  PixKeyType,
  WalletEntry,
  WalletService,
  WithdrawQuote,
} from '../types';
import { invokeEdge, PaymentsApiError } from './edgeClient';
import {
  mapMerchantLedger,
  mapPayerPayment,
  mapPaymentStatus,
  mapPixKey,
  type LedgerRow,
  type PayerPaymentRow,
  type PixKeyRow,
} from './mappers';

/** Deep link de volta do 3DS e do Pix (scheme do app.json). */
export const STRIPE_RETURN_URL = 'walltoall://stripe-redirect';

/** Prazo do saque: transfer síncrono para a conta Stripe (design § 16). */
export const STRIPE_WITHDRAW_ETA_LABEL = 'Na hora, na sua conta de recebimento';

interface CreateIntentResponse {
  paymentId: string;
  status: PaymentStatus;
  clientSecret?: string;
  failureCode?: string;
  pix?: {
    copyPasteCode: string;
    qrImageUrl: string | null;
    hostedInstructionsUrl: string | null;
    expiresAt: string;
  };
}

export interface StripeWalletServiceOptions {
  /** Intervalo do polling do status no banco. Default 2 s. */
  pollIntervalMs?: number;
  /** Espera máxima pelo webhook no cartão. Default 60 s. */
  pollTimeoutMs?: number;
}

function requireContext(context: PaymentRequestContext | undefined): PaymentRequestContext {
  if (!context) {
    // Erro de programação: a cobrança real precisa da finalidade para o
    // servidor conferir o valor.
    throw new Error('Cobrança sem finalidade (context) na implementação Stripe.');
  }
  return context;
}

export class StripeWalletService implements WalletService {
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private businessCache: { userId: string; promise: Promise<number> } | null = null;

  constructor(options: StripeWalletServiceOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 60000;
  }

  // ── cartões ──────────────────────────────────────────────

  getCards(): Promise<PaymentCard[]> {
    return invokeEdge<PaymentCard[]>('payments-cards', { method: 'GET' });
  }

  /** O cartão entra pelo CardField: a tela confirma o SetupIntent no SDK. */
  readonly cardSetupConfirmsWithStripe = true;

  beginCardSetup(): Promise<{ setupIntentClientSecret: string }> {
    return invokeEdge('payments-cards', { body: { action: 'setup' } });
  }

  completeCardSetup(setupIntentId: string): Promise<PaymentCard> {
    return invokeEdge<PaymentCard>('payments-cards', {
      body: { action: 'complete', setupIntentId },
    });
  }

  // ── cobranças ────────────────────────────────────────────

  async payWithCard(
    cardId: string,
    amountCents: number,
    description: string,
    context?: PaymentRequestContext,
  ): Promise<{ status: 'approved' | 'declined'; paymentId?: string }> {
    void description;
    const ctx = requireContext(context);
    let response: CreateIntentResponse;
    try {
      response = await invokeEdge<CreateIntentResponse>('payments-create-intent', {
        body: {
          purpose: ctx.purpose,
          method: 'card',
          cardId,
          amountCents,
          idempotencyKey: ctx.idempotencyKey,
        },
      });
    } catch (err) {
      if (err instanceof PaymentsApiError && err.code === 'card_declined') {
        return { status: 'declined' };
      }
      throw err;
    }
    const { paymentId } = response;

    if (response.status === 'failed' || response.status === 'canceled') {
      return { status: 'declined', paymentId };
    }
    if (response.status === 'requires_action') {
      if (!response.clientSecret) return { status: 'declined', paymentId };
      const result = await handleNextAction(response.clientSecret, STRIPE_RETURN_URL);
      if (result.error) return { status: 'declined', paymentId };
    }

    const settled = await awaitPaymentSettled(() => this.getPaymentStatus(paymentId), {
      intervalMs: this.pollIntervalMs,
      timeoutMs: this.pollTimeoutMs,
    });
    if (settled === 'succeeded') return { status: 'approved', paymentId };
    if (settled === 'timeout' || settled === 'aborted') {
      // Pode ainda ser aprovado pelo webhook; nova tentativa com a mesma chave
      // reaproveita a cobrança, sem cobrar duas vezes.
      throw new PaymentsApiError('timeout');
    }
    return { status: 'declined', paymentId };
  }

  async createPixCharge(
    amountCents: number,
    description: string,
    context?: PaymentRequestContext,
  ): Promise<PixCharge> {
    void description;
    const ctx = requireContext(context);
    const response = await invokeEdge<CreateIntentResponse>('payments-create-intent', {
      body: {
        purpose: ctx.purpose,
        method: 'pix',
        amountCents,
        idempotencyKey: ctx.idempotencyKey,
      },
    });
    const pix = response.pix;
    if (!pix) {
      // Já pago (mesma chave): sem QR novo; a tela vê `succeeded` no polling.
      if (response.status === 'succeeded') {
        return {
          qrCode: '',
          copyPasteCode: '',
          amountCents,
          expiresAt: new Date().toISOString(),
          paymentId: response.paymentId,
          qrImageUrl: null,
        };
      }
      throw new PaymentsApiError('provider_error');
    }
    return {
      qrCode: pix.copyPasteCode,
      copyPasteCode: pix.copyPasteCode,
      qrImageUrl: pix.qrImageUrl,
      amountCents,
      expiresAt: pix.expiresAt,
      paymentId: response.paymentId,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const { data, error } = await supabase
      .from('payments')
      .select('status')
      .eq('id', paymentId)
      .single();
    if (error) throw error;
    return mapPaymentStatus((data as { status: string }).status);
  }

  // ── conta de recebimento ─────────────────────────────────

  async getPayoutAccountStatus(): Promise<PayoutAccountStatus> {
    const body = await invokeEdge<{ status: PayoutAccountStatus }>('connect-onboarding', {
      method: 'GET',
    });
    return body.status;
  }

  startPayoutOnboarding(): Promise<{ url: string }> {
    return invokeEdge<{ url: string }>('connect-onboarding', { body: { action: 'link' } });
  }

  // ── cliente ──────────────────────────────────────────────

  async getPixKeys(): Promise<PixKey[]> {
    const { data, error } = await supabase
      .from('my_pix_keys')
      .select('id, type, masked_value, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as PixKeyRow[]).map(mapPixKey);
  }

  async addPixKey(input: { type: PixKeyType; value: string }): Promise<PixKey> {
    const { data, error } = await supabase.rpc('add_pix_key', {
      p_type: input.type,
      p_value: input.value,
    });
    if (error) {
      // Validação do banco (22023) já vem em pt-BR ("CPF inválido.").
      if ((error as { code?: string }).code === '22023') throw new Error(error.message);
      throw new Error('Não foi possível salvar a chave Pix. Tente de novo.');
    }
    return mapPixKey(data as unknown as PixKeyRow);
  }

  async getStatement(): Promise<WalletEntry[]> {
    const userId = await this.userId();
    const { data, error } = await supabase
      .from('payments')
      .select('id, purpose, method, amount_cents, paid_at, created_at')
      .eq('payer_id', userId)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as PayerPaymentRow[]).map(mapPayerPayment);
  }

  // ── lojista ──────────────────────────────────────────────

  async getMerchantBalanceCents(): Promise<number> {
    const businessId = await this.businessId();
    const { data, error } = await supabase.rpc('merchant_balance_cents', {
      p_business_id: businessId,
      p_account: 'merchant',
    });
    if (error) throw error;
    return Number(data ?? 0);
  }

  async getMerchantStatement(): Promise<WalletEntry[]> {
    const businessId = await this.businessId();
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('id, kind, amount_cents, title, subtitle, created_at, withdrawal_id')
      .eq('business_id', businessId)
      .eq('account', 'merchant')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as LedgerRow[]).map(mapMerchantLedger);
  }

  async quoteWithdraw(amountCents: number): Promise<WithdrawQuote> {
    // Mesma régua do servidor (teste de paridade da Task 3).
    return { ...computeWithdrawQuote(amountCents), etaLabel: STRIPE_WITHDRAW_ETA_LABEL };
  }

  async requestWithdraw(
    amountCents: number,
    pixKeyId: string,
    idempotencyKey?: string,
  ): Promise<void> {
    await invokeEdge('wallet-withdraw', {
      body: {
        source: 'financeiro',
        amountCents,
        pixKeyId,
        idempotencyKey: idempotencyKey ?? newCheckoutKey(),
      },
    });
  }

  // ── apoio ────────────────────────────────────────────────

  private async userId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new PaymentsApiError('unauthorized', 401);
    return data.user.id;
  }

  /**
   * Negócio do usuário logado. Cache por usuário (o serviço vive o app todo e
   * a conta pode trocar); falha não fica em cache.
   */
  private async businessId(): Promise<number> {
    const userId = await this.userId();
    if (this.businessCache?.userId !== userId) {
      const promise = (async () => {
        const { data, error } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('owner_id', userId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new PaymentsApiError('forbidden', 403);
        return (data as { id: number }).id;
      })();
      this.businessCache = { userId, promise };
      promise.catch(() => {
        if (this.businessCache?.promise === promise) this.businessCache = null;
      });
    }
    return this.businessCache!.promise;
  }
}
