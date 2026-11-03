import { isValid, parseISO } from 'date-fns';

// Meses próprios em vez do locale do date-fns/dispositivo: o ptBR do date-fns
// abrevia com ponto ("jun.") e o Figma mostra "14 jun 2026".
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-06-14T12:00:00.000Z" → "14 jun 2026". ISO inválido lança. */
export function formatSubscriptionDate(iso: string): string {
  const date = parseISO(iso);
  if (!isValid(date)) {
    throw new Error(`Data inválida: ${iso}`);
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
