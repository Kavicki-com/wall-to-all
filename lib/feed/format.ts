import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FeedPost } from '../services/feedTypes';

/** Trunca na 1ª casa decimal (nunca arredonda para cima) e omite ",0". */
function oneDecimal(value: number): string {
  const truncated = Math.floor(value * 10) / 10;
  return Number.isInteger(truncated) ? String(truncated) : truncated.toFixed(1).replace('.', ',');
}

/** Contagem compacta pt-BR para o trilho de ações ("45,2k", "1,5 mi"). */
export function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${oneDecimal(n / 1000)}k`;
  return `${oneDecimal(n / 1_000_000)} mi`;
}

/** Segundos para "mm:ss" (timer da câmera e do player). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Linha "serviço · 12 mai" do rodapé do card. */
export function formatPostMeta(post: Pick<FeedPost, 'linkedService' | 'createdAt'>): string {
  const date = format(new Date(post.createdAt), 'd MMM', { locale: ptBR });
  return post.linkedService ? `${post.linkedService.name} · ${date}` : date;
}
