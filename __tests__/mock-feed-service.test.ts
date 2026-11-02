import { MockFeedService, SIMULATED_LATENCY_MS } from '../lib/services/mock/mockFeedService';
import type { PublishPostInput } from '../lib/services/feedTypes';

const HOUR = 60 * 60 * 1000;

const author = { businessId: 900, name: 'Minha Loja', handle: '@minhaLoja', logoUrl: null };

function videoInput(overrides: Partial<PublishPostInput> = {}): PublishPostInput {
  return {
    author,
    mediaType: 'video',
    mediaUri: 'file:///video.mp4',
    durationSec: 24,
    caption: 'Novo corte',
    category: 'Cabelo',
    linkedService: null,
    allowDownloads: false,
    shareWithLinkedClients: true,
    ...overrides,
  };
}

describe('MockFeedService', () => {
  let clock: Date;
  let service: MockFeedService;

  beforeEach(() => {
    clock = new Date('2026-11-02T12:00:00.000Z');
    service = new MockFeedService({ now: () => clock });
  });

  it('exporta a latência simulada do app', () => {
    expect(SIMULATED_LATENCY_MS).toBe(300);
  });

  it('listFeed devolve as fixtures do mais novo ao mais antigo', async () => {
    const feed = await service.listFeed();
    expect(feed).toHaveLength(6);
    const times = feed.map((p) => new Date(p.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const [first] = feed;
    expect(first.author.handle).toBe('@anaCabelos');
    expect(first.likeCount).toBe(45200);
    expect(first.linkedService?.name).toBe('Corte feminino');
    expect(first.mediaType).toBe('video');
  });

  it('listStories só inclui lojas com post nas últimas 24h, do grupo mais recente ao mais antigo', async () => {
    const stories = await service.listStories();
    const names = stories.map((g) => g.author.name);
    expect(names).toEqual(['Ana Cabelos', 'Zara Moda', 'Varejo Silva', 'Mix Magazine']);
    expect(names).not.toContain('Bella Boutique');
    // O post de 3 dias da Ana fica fora da janela.
    expect(stories[0].posts.map((p) => p.id)).toEqual(['fx-1']);
  });

  it('posts dentro do grupo ficam em ordem cronológica crescente', async () => {
    await service.publishPost(
      videoInput({
        author: { ...author, businessId: 101, name: 'Ana Cabelos', handle: '@anaCabelos' },
      }),
    );
    const [ana] = await service.listStories();
    expect(ana.author.businessId).toBe(101);
    expect(ana.posts).toHaveLength(2);
    const times = ana.posts.map((p) => new Date(p.createdAt).getTime());
    expect(times[0]).toBeLessThan(times[1]);
  });

  it('com o relógio 24h à frente, o post sai dos stories mas continua no feed', async () => {
    clock = new Date(clock.getTime() + 24 * HOUR);
    expect(await service.listStories()).toEqual([]);
    expect(await service.listFeed()).toHaveLength(6);
  });

  it('publishPost válido entra no topo do feed e vira grupo de story', async () => {
    const post = await service.publishPost(videoInput());
    expect(post.id).toMatch(/^post-/);
    expect(post.likeCount).toBe(0);
    expect(post.likedByMe).toBe(false);
    expect(post.createdAt).toBe(clock.toISOString());

    const feed = await service.listFeed();
    expect(feed[0].id).toBe(post.id);
    const stories = await service.listStories();
    expect(stories[0].author.businessId).toBe(900);
    expect(stories[0].posts.map((p) => p.id)).toEqual([post.id]);
  });

  it('publishPost aceita foto sem duração', async () => {
    const post = await service.publishPost(videoInput({ mediaType: 'photo', durationSec: null }));
    expect(post.mediaType).toBe('photo');
    expect(post.durationSec).toBeNull();
  });

  it.each<[string, Partial<PublishPostInput>]>([
    ['mídia vazia', { mediaUri: '' }],
    ['vídeo sem duração', { durationSec: null }],
    ['vídeo com duração 0', { durationSec: 0 }],
    ['vídeo acima de 30s', { durationSec: 31 }],
    ['foto com duração', { mediaType: 'photo', durationSec: 5 }],
    ['legenda acima de 300 caracteres', { caption: 'a'.repeat(301) }],
  ])('publishPost rejeita %s', async (_label, overrides) => {
    await expect(service.publishPost(videoInput(overrides))).rejects.toThrow();
    expect(await service.listFeed()).toHaveLength(6);
  });

  it('toggleLike alterna a curtida e ajusta a contagem', async () => {
    expect(await service.toggleLike('fx-2')).toEqual({ liked: true, likeCount: 1251 });
    let post = (await service.listFeed()).find((p) => p.id === 'fx-2')!;
    expect(post.likedByMe).toBe(true);
    expect(post.likeCount).toBe(1251);

    expect(await service.toggleLike('fx-2')).toEqual({ liked: false, likeCount: 1250 });
    post = (await service.listFeed()).find((p) => p.id === 'fx-2')!;
    expect(post.likedByMe).toBe(false);
  });

  it('toggleLike rejeita id desconhecido', async () => {
    await expect(service.toggleLike('nao-existe')).rejects.toThrow('Publicação não encontrada.');
  });

  it('setFollowing adiciona, remove e é idempotente', async () => {
    expect(await service.listFollowing()).toEqual([]);
    await service.setFollowing(101, true);
    await service.setFollowing(101, true);
    expect(await service.listFollowing()).toEqual([101]);
    await service.setFollowing(101, false);
    await service.setFollowing(101, false);
    expect(await service.listFollowing()).toEqual([]);
  });

  it('listCategories devolve as categorias fixas', async () => {
    expect(await service.listCategories()).toEqual([
      'Cabelo',
      'Barba',
      'Manicure',
      'Estética',
      'Maquiagem',
      'Outros',
    ]);
  });

  it('retornos são cópias defensivas', async () => {
    const feed = await service.listFeed();
    feed[0].likeCount = -1;
    feed[0].author.name = 'Alterado';
    feed.pop();
    const categories = await service.listCategories();
    categories.push('Hackeada');
    const stories = await service.listStories();
    stories[0].posts[0].caption = 'Alterada';

    const fresh = await service.listFeed();
    expect(fresh).toHaveLength(6);
    expect(fresh[0].likeCount).toBe(45200);
    expect(fresh[0].author.name).toBe('Ana Cabelos');
    expect(fresh[0].caption).not.toBe('Alterada');
    expect(await service.listCategories()).not.toContain('Hackeada');
  });

  it('latência default 0 resolve sem timers', async () => {
    jest.useFakeTimers();
    try {
      await expect(service.listFeed()).resolves.toHaveLength(6);
    } finally {
      jest.useRealTimers();
    }
  });
});
