/**
 * QI com dinheiro real (F8, Task 16): implementação HÍBRIDA.
 *
 * Real: o saldo (`balanceCents` do resumo), lido do ledger, onde o webhook
 * credita o cashback (`qi_cashback`); e o saque, pelo `wallet-withdraw`
 * (`qi_client` fica `manual_pending`; `qi_merchant` vira transfer, design § 16).
 *
 * Mock (delegado ao `MockQiService`): código, indicações, extrato por
 * indicação, regras e cotação. O resto do resumo (lucro total, contadores,
 * meta) também segue do mock: o piloto mostra só o saldo de verdade.
 */

import { supabase } from '../../supabase';
import { newCheckoutKey } from '../../payments/checkoutKey';
import { formatBRL } from '../../formatters';
import type {
  QiIndicacao,
  QiProgramRules,
  QiService,
  QiSide,
  QiStatementEntry,
  QiSummary,
  WithdrawQuote,
} from '../types';
import { invokeEdge } from './edgeClient';

export interface StripeQiServiceOptions {
  /** Serviço que responde o que ainda é mock (o `MockQiService`). */
  base: QiService;
  /** Negócio do lojista logado (o mesmo do `StripeWalletService`). */
  businessId: () => Promise<number>;
}

export class StripeQiService implements QiService {
  private readonly base: QiService;
  private readonly businessId: () => Promise<number>;

  constructor(options: StripeQiServiceOptions) {
    this.base = options.base;
    this.businessId = options.businessId;
  }

  async getQiSummary(side: QiSide): Promise<QiSummary> {
    const [summary, balanceCents] = await Promise.all([
      this.base.getQiSummary(side),
      this.balanceCents(side),
    ]);
    return { ...summary, balanceCents };
  }

  getQiCode(side: QiSide): Promise<string> {
    return this.base.getQiCode(side);
  }

  listIndicacoes(
    side: QiSide,
    page: number,
  ): Promise<{ items: QiIndicacao[]; page: number; totalPages: number }> {
    return this.base.listIndicacoes(side, page);
  }

  getIndicacao(side: QiSide, id: string): Promise<QiIndicacao> {
    return this.base.getIndicacao(side, id);
  }

  getIndicacaoStatement(side: QiSide, id: string): Promise<QiStatementEntry[]> {
    return this.base.getIndicacaoStatement(side, id);
  }

  getProgramRules(): Promise<QiProgramRules> {
    return this.base.getProgramRules();
  }

  quoteWithdraw(amountCents: number): Promise<WithdrawQuote> {
    return this.base.quoteWithdraw(amountCents);
  }

  async requestQiWithdraw(
    side: QiSide,
    amountCents: number,
    pixKeyId: string,
    idempotencyKey?: string,
  ): Promise<void> {
    const { minWithdrawCents } = await this.base.getProgramRules();
    if (amountCents < minWithdrawCents) {
      throw new Error(`O valor mínimo de saque é ${formatBRL(minWithdrawCents)}.`);
    }
    await invokeEdge('wallet-withdraw', {
      body: {
        source: side === 'client' ? 'qi_client' : 'qi_merchant',
        amountCents,
        pixKeyId,
        idempotencyKey: idempotencyKey ?? newCheckoutKey(),
      },
    });
  }

  private async balanceCents(side: QiSide): Promise<number> {
    if (side === 'client') {
      const { data, error } = await supabase.rpc('my_qi_balance_cents');
      if (error) throw error;
      return Number(data ?? 0);
    }
    const businessId = await this.businessId();
    const { data, error } = await supabase.rpc('merchant_balance_cents', {
      p_business_id: businessId,
      p_account: 'merchant_qi',
    });
    if (error) throw error;
    return Number(data ?? 0);
  }
}
