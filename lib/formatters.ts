export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Formata um valor em CENTAVOS como "R$ 15,00" (vírgula decimal pt-BR).
 * Usado pelas telas do "Aqui e Agora" (preço do fura-fila etc.), onde os
 * valores do domínio da fila são inteiros em centavos. Difere de
 * `formatCurrency`, que recebe reais.
 */
export const formatBRL = (cents: number): string =>
  `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
