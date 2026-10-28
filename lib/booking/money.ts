/**
 * `Service.price` vem do Supabase em REAIS (numeric); o resto do app (carteira,
 * `formatBRL`, BookingPaymentService) trabalha em CENTAVOS inteiros. Converter
 * uma única vez, na borda, com arredondamento para absorver ruído de ponto
 * flutuante (ex.: 115.1 * 100 = 11509.999...).
 */
export function priceToCents(price: number): number {
  return Math.round(price * 100);
}
