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

/**
 * Distância legível: "800 m" para < 1 km, "0,3 km"/"2,4 km" para >= 1 km
 * (vírgula decimal pt-BR). `distanceKm` já vem arredondado a 1 casa pelo
 * QueueService. Usado pelas telas do "Aqui e Agora" (lista de resultados, senha).
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}
