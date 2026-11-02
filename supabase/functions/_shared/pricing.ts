/**
 * Regras de valor do servidor (puro: sem Deno, sem import de URL; coberto
 * pelo jest em `__tests__/edge-pricing.test.ts`).
 *
 * Espelha os helpers do app que não podem ser importados daqui (o bundle da
 * Edge Function só leva `supabase/functions`): `priceToCents` de
 * `lib/booking/money.ts` e `computeWithdrawQuote` de
 * `lib/services/mock/withdrawQuote.ts`. O teste de paridade garante que o app
 * e o servidor cotam igual.
 */

/** Valor mínimo de saque do QI (em centavos): R$ 30,00. */
export const MIN_WITHDRAW_CENTS = 3000;

/** Taxa fixa de saque (em centavos): R$ 5,00. */
export const WITHDRAW_FEE_CENTS = 500;

/** A partir deste valor (em centavos) o saque é isento de taxa: R$ 200,00. */
export const FEE_FREE_THRESHOLD_CENTS = 20000;

/** Prazo de crédito exibido na cotação. */
export const WITHDRAW_ETA_LABEL = 'Até 24 horas';

export interface WithdrawQuote {
  amountCents: number;
  feeCents: number;
  /** Líquido a receber (valor menos taxa). */
  totalCents: number;
  etaLabel: string;
}

function assertPositiveCents(amountCents: number, label: string): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`${label} deve ser um inteiro positivo em centavos.`);
  }
}

/**
 * `services.price` vem do Postgres em REAIS (numeric). Arredonda para absorver
 * o ruído de ponto flutuante (115.1 * 100 = 11509.999...).
 */
export function priceToCents(price: number): number {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Preço inválido.');
  }
  return Math.round(price * 100);
}

/**
 * Taxa da plataforma em basis points (1000 = 10%). Arredonda para baixo: o
 * centavo fracionário fica com o lojista.
 */
export function platformFeeCents(amountCents: number, feeBps: number): number {
  assertPositiveCents(amountCents, 'O valor');
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
    throw new Error('A taxa da plataforma deve ser um inteiro entre 0 e 10000 bps.');
  }
  return Math.floor((amountCents * feeBps) / 10000);
}

/** Cotação de saque: R$ 5,00 abaixo de R$ 200,00; isento a partir disso. */
export function quoteWithdraw(amountCents: number): WithdrawQuote {
  assertPositiveCents(amountCents, 'O valor do saque');
  const feeCents = amountCents < FEE_FREE_THRESHOLD_CENTS ? WITHDRAW_FEE_CENTS : 0;
  return {
    amountCents,
    feeCents,
    totalCents: amountCents - feeCents,
    etaLabel: WITHDRAW_ETA_LABEL,
  };
}
