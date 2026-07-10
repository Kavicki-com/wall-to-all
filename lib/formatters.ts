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

/**
 * Formata reais SEM casas decimais no padrão pt-BR: 6000 → "R$ 6.000". Usado
 * pelos dashboards (F2), onde os valores são inteiros de reais e a UI não mostra
 * centavos (difere de `formatCurrency`, que usa 2 casas, e de `formatBRL`, que
 * recebe centavos).
 */
export function formatReais(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Iniciais (até 2, maiúsculas) de um nome, para avatares decorativos quando não
 * há foto: "João Pedro" → "JP", "Você" → "V", "" → "?". Fonte única reutilizada
 * pelas telas do novo escopo (destaque, stories, fila, solicitação recebida).
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
