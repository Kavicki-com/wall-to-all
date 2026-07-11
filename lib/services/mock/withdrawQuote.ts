import type { WithdrawQuote } from '../types';

/** Valor mínimo de saque (em centavos): R$ 30,00. */
export const MIN_WITHDRAW_CENTS = 3000;

/** Taxa fixa de saque (em centavos): R$ 5,00. */
export const WITHDRAW_FEE_CENTS = 500;

/** A partir deste valor (em centavos) o saque é isento de taxa: R$ 200,00. */
export const FEE_FREE_THRESHOLD_CENTS = 20000;

/** Prazo de crédito exibido na cotação ("Até 24 horas"). */
export const WITHDRAW_ETA_LABEL = 'Até 24 horas';

/**
 * Calcula a cotação de um saque: taxa fixa de R$ 5,00 abaixo do teto de
 * isenção (R$ 200,00); zero a partir dele. `totalCents` é o líquido a receber
 * (valor − taxa). Helper PURO — reusado pelo `MockWalletService` (Task 3)
 * além do `MockQiService`, para as duas telas de saque cotarem igual.
 */
export function computeWithdrawQuote(amountCents: number): WithdrawQuote {
  const feeCents = amountCents < FEE_FREE_THRESHOLD_CENTS ? WITHDRAW_FEE_CENTS : 0;
  return {
    amountCents,
    feeCents,
    totalCents: amountCents - feeCents,
    etaLabel: WITHDRAW_ETA_LABEL,
  };
}
