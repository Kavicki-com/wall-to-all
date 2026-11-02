/**
 * Contrato do domínio de feed (F6).
 *
 * Fica fora de `types.ts` de propósito: a F8 está mudando os contratos daquele
 * arquivo em paralelo, e manter o feed num módulo próprio evita conflito no
 * rebase. Importar direto deste módulo (sem re-export em `types.ts`).
 */

export type FeedMediaType = 'photo' | 'video';

export interface FeedAuthor {
  businessId: number;
  name: string;
  /** Com "@", derivado do nome ("Ana Cabelos" vira "@anaCabelos"). */
  handle: string;
  logoUrl: string | null;
}

/** Snapshot do serviço vinculado no momento da publicação. */
export interface FeedLinkedService {
  serviceId: number;
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  mediaType: FeedMediaType;
  mediaUri: string;
  /** Capa para vídeo; null usa a própria mídia (foto) ou fundo neutro. */
  posterUri: string | null;
  /** Só para vídeo; segundos inteiros, 1..30. */
  durationSec: number | null;
  caption: string;
  category: string | null;
  linkedService: FeedLinkedService | null;
  allowDownloads: boolean;
  shareWithLinkedClients: boolean;
  likeCount: number;
  likedByMe: boolean;
  /** ISO 8601. */
  createdAt: string;
}

/** Anel da fila de stories: posts da loja nas últimas 24h, do mais antigo ao mais novo. */
export interface FeedStoryGroup {
  author: FeedAuthor;
  posts: FeedPost[];
}

export type PublishPostInput = Pick<
  FeedPost,
  | 'author'
  | 'mediaType'
  | 'mediaUri'
  | 'durationSec'
  | 'caption'
  | 'category'
  | 'linkedService'
  | 'allowDownloads'
  | 'shareWithLinkedClients'
>;

export const MAX_VIDEO_SECONDS = 30;
export const STORY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Limite da legenda no composer e no mock. */
export const MAX_CAPTION_LENGTH = 300;

export interface FeedService {
  /** Todos os posts, do mais novo ao mais antigo. */
  listFeed(): Promise<FeedPost[]>;
  /** Grupos com post nas últimas 24h, ordenados pelo post mais recente (desc). */
  listStories(): Promise<FeedStoryGroup[]>;
  listCategories(): Promise<string[]>;
  /** Rejeita mídia vazia e vídeo sem duração ou acima de MAX_VIDEO_SECONDS. */
  publishPost(input: PublishPostInput): Promise<FeedPost>;
  /** Alterna a curtida; rejeita id desconhecido. */
  toggleLike(postId: string): Promise<{ liked: boolean; likeCount: number }>;
  listFollowing(): Promise<number[]>;
  setFollowing(businessId: number, following: boolean): Promise<void>;
}
