import {
  MAX_CAPTION_LENGTH,
  MAX_VIDEO_SECONDS,
  STORY_WINDOW_MS,
  type FeedAuthor,
  type FeedLinkedService,
  type FeedPost,
  type FeedService,
  type FeedStoryGroup,
  type PublishPostInput,
} from '../feedTypes';
import { buildHandle } from '../../feed/author';

/**
 * Latência simulada (ms) para uso no app real. Mesmo design dos outros mocks:
 * o construtor aceita `latencyMs` com default **0** (testes resolvem via
 * microtask), e o ServicesProvider passa `SIMULATED_LATENCY_MS` explicitamente.
 */
export const SIMULATED_LATENCY_MS = 300;

export interface MockFeedServiceOptions {
  /** Latência simulada (ms) das operações. Default 0 (ver SIMULATED_LATENCY_MS). */
  latencyMs?: number;
  /** Relógio injetável para testar a janela de 24h dos stories. Default `new Date()`. */
  now?: () => Date;
}

const CATEGORIES = ['Cabelo', 'Barba', 'Manicure', 'Estética', 'Maquiagem', 'Outros'];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SAMPLE_VIDEO_BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';

function picsum(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

function fixtureAuthor(businessId: number, name: string, slug: string): FeedAuthor {
  return { businessId, name, handle: buildHandle(name), logoUrl: picsum(`${slug}-logo`, 200, 200) };
}

function copyPost(post: FeedPost): FeedPost {
  return {
    ...post,
    author: { ...post.author },
    linkedService: post.linkedService && { ...post.linkedService },
  };
}

interface FixtureSpec {
  id: string;
  author: FeedAuthor;
  mediaType: FeedPost['mediaType'];
  mediaUri: string;
  posterUri: string | null;
  durationSec: number | null;
  caption: string;
  category: string | null;
  ageMs: number;
  likeCount: number;
  linkedService: FeedLinkedService | null;
}

/**
 * Feed em memória (F6). Sem persistência: some ao recarregar o app, aceitável
 * enquanto o feed é mock (a F8 troca por tabelas + storage). Curtidas e
 * "seguindo" ficam no mesmo singleton, sem distinção de usuário.
 */
export class MockFeedService implements FeedService {
  private readonly latencyMs: number;
  private readonly now: () => Date;
  private readonly posts: FeedPost[];
  private readonly following = new Set<number>();
  private idCounter = 0;

  constructor(options: MockFeedServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.now = options.now ?? (() => new Date());
    this.posts = this.buildFixtures(this.now().getTime());
  }

  async listFeed(): Promise<FeedPost[]> {
    await this.delay();
    return this.sortedDesc().map(copyPost);
  }

  async listStories(): Promise<FeedStoryGroup[]> {
    await this.delay();
    const nowMs = this.now().getTime();
    const groups = new Map<number, FeedStoryGroup>();
    // Percorre do mais novo ao mais antigo: a ordem de inserção no Map já é a
    // ordem dos grupos (pelo post mais recente, desc).
    for (const post of this.sortedDesc()) {
      const age = nowMs - new Date(post.createdAt).getTime();
      if (age < 0 || age >= STORY_WINDOW_MS) continue;
      const group = groups.get(post.author.businessId);
      if (group) {
        group.posts.unshift(copyPost(post));
      } else {
        groups.set(post.author.businessId, {
          author: { ...post.author },
          posts: [copyPost(post)],
        });
      }
    }
    return Array.from(groups.values());
  }

  async listCategories(): Promise<string[]> {
    await this.delay();
    return [...CATEGORIES];
  }

  async publishPost(input: PublishPostInput): Promise<FeedPost> {
    await this.delay();
    if (!input.mediaUri) {
      throw new Error('Selecione uma foto ou vídeo para publicar.');
    }
    if (input.mediaType === 'video') {
      const d = input.durationSec;
      if (d == null || d <= 0 || d > MAX_VIDEO_SECONDS) {
        throw new Error(`O vídeo deve ter entre 1 e ${MAX_VIDEO_SECONDS} segundos.`);
      }
    } else if (input.durationSec !== null) {
      throw new Error('Foto não tem duração.');
    }
    if (input.caption.length > MAX_CAPTION_LENGTH) {
      throw new Error(`A legenda pode ter no máximo ${MAX_CAPTION_LENGTH} caracteres.`);
    }

    this.idCounter += 1;
    const post: FeedPost = {
      ...input,
      author: { ...input.author },
      linkedService: input.linkedService && { ...input.linkedService },
      id: `post-${Date.now()}-${this.idCounter}`,
      posterUri: null,
      likeCount: 0,
      likedByMe: false,
      createdAt: this.now().toISOString(),
    };
    this.posts.push(post);
    return copyPost(post);
  }

  async toggleLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
    await this.delay();
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error('Publicação não encontrada.');
    }
    post.likedByMe = !post.likedByMe;
    post.likeCount += post.likedByMe ? 1 : -1;
    return { liked: post.likedByMe, likeCount: post.likeCount };
  }

  async listFollowing(): Promise<number[]> {
    await this.delay();
    return Array.from(this.following);
  }

  async setFollowing(businessId: number, following: boolean): Promise<void> {
    await this.delay();
    if (following) {
      this.following.add(businessId);
    } else {
      this.following.delete(businessId);
    }
  }

  private sortedDesc(): FeedPost[] {
    return [...this.posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private buildFixtures(nowMs: number): FeedPost[] {
    const ana = fixtureAuthor(101, 'Ana Cabelos', 'ana-cabelos');
    const zara = fixtureAuthor(102, 'Zara Moda', 'zara-moda');
    const bella = fixtureAuthor(103, 'Bella Boutique', 'bella-boutique');
    const varejo = fixtureAuthor(104, 'Varejo Silva', 'varejo-silva');
    const mix = fixtureAuthor(105, 'Mix Magazine', 'mix-magazine');

    const specs: FixtureSpec[] = [
      {
        id: 'fx-1',
        author: ana,
        mediaType: 'video',
        mediaUri: `${SAMPLE_VIDEO_BASE}/ForBiggerBlazes.mp4`,
        posterUri: picsum('fx-1', 720, 1280),
        durationSec: 24,
        caption: 'Corte novo para o verão, agenda aberta esta semana!',
        category: 'Cabelo',
        ageMs: 30 * MINUTE,
        likeCount: 45200,
        linkedService: {
          serviceId: 9001,
          name: 'Corte feminino',
          priceCents: 8000,
          durationMinutes: 60,
        },
      },
      {
        id: 'fx-2',
        author: zara,
        mediaType: 'photo',
        mediaUri: picsum('fx-2', 720, 1280),
        posterUri: null,
        durationSec: null,
        caption: 'Coleção nova chegando na loja.',
        category: null,
        ageMs: 2 * HOUR,
        likeCount: 1250,
        linkedService: null,
      },
      {
        id: 'fx-3',
        author: varejo,
        mediaType: 'video',
        mediaUri: `${SAMPLE_VIDEO_BASE}/ForBiggerEscapes.mp4`,
        posterUri: picsum('fx-3', 720, 1280),
        durationSec: 18,
        caption: 'Promoção relâmpago só hoje.',
        category: null,
        ageMs: 5 * HOUR,
        likeCount: 830,
        linkedService: null,
      },
      {
        id: 'fx-4',
        author: mix,
        mediaType: 'photo',
        mediaUri: picsum('fx-4', 720, 1280),
        posterUri: null,
        durationSec: null,
        caption: 'Vitrine montada, venha conferir!',
        category: null,
        ageMs: 20 * HOUR,
        likeCount: 12900,
        linkedService: null,
      },
      {
        id: 'fx-5',
        author: bella,
        mediaType: 'video',
        mediaUri: `${SAMPLE_VIDEO_BASE}/ForBiggerFun.mp4`,
        posterUri: picsum('fx-5', 720, 1280),
        durationSec: 30,
        caption: 'Escova modelada do jeito que você gosta.',
        category: 'Cabelo',
        ageMs: 26 * HOUR,
        likeCount: 3100,
        linkedService: { serviceId: 9002, name: 'Escova', priceCents: 6000, durationMinutes: 45 },
      },
      {
        id: 'fx-6',
        author: ana,
        mediaType: 'photo',
        mediaUri: picsum('fx-6', 720, 1280),
        posterUri: null,
        durationSec: null,
        caption: 'Antes e depois da coloração.',
        category: 'Cabelo',
        ageMs: 3 * DAY,
        likeCount: 980,
        linkedService: {
          serviceId: 9003,
          name: 'Coloração',
          priceCents: 15000,
          durationMinutes: 120,
        },
      },
    ];

    return specs.map(({ ageMs, ...spec }) => ({
      ...spec,
      allowDownloads: false,
      shareWithLinkedClients: true,
      likedByMe: false,
      createdAt: new Date(nowMs - ageMs).toISOString(),
    }));
  }

  /**
   * Latência simulada: com latencyMs === 0 resolve via microtask para manter
   * os testes rápidos; com > 0 usa setTimeout de verdade.
   */
  private async delay(): Promise<void> {
    if (this.latencyMs === 0) {
      await Promise.resolve();
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
