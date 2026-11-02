# F6: Feed (lojista + cliente). Design

**Data:** 2026-11-02
**Fase:** 6 do novo escopo (`docs/plans/2026-07-06-novo-escopo-master.md`, § Fase 6)
**Branch:** `feat/f6-feed` (worktree `.worktrees/f6-feed`, criado de `origin/main` em `4cca553`)
**Figma:** fileKey `c1QOl8EocqBiGd6R2NzrFn`. Lojista (seção `2643:7837`): feed `2485:146` · feed-past-post `2563:5334` · record-video-post `2501:396` · preview-post `2502:396`. Cliente (seção `2643:7838`): feed `2643:7839`
**Paralelismo:** F6, F7 (perfil do lojista + assinatura) e F8 (pagamentos Stripe, worktree `.worktrees/f8-pagamentos-stripe`) rodam ao mesmo tempo em sessões separadas. Território e zonas compartilhadas na § 8.

O feed é feature NOVA: não existe rota, serviço nem componente de feed na main. O único ponto de contato prévio é a `StoriesRow` da home do cliente (F2), com um `TODO(F6)` no toque. Tudo é mock-first: nenhuma mídia sobe de verdade nesta fase.

---

## 1. Decisões (2026-11-02)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Stories | **Story = posts das últimas 24h.** Não existe entidade "story". Uma loja ganha anel na fila quando publicou nas últimas 24h; o toque abre um visualizador em tela cheia (modal) com esses posts, do mais antigo ao mais novo. O post continua permanente no feed. Uma única coisa para gravar, subir e moderar na F8. |
| 2 | Biblioteca de vídeo | **`expo-camera` (gravação) + `expo-video` (reprodução)**, já instalados e configurados no `app.json` desde a F0 (decisão #5 do doc mestre), inclusive a permissão de microfone. Gravação com `recordAsync({ maxDuration: 30 })` e `videoQuality="720p"`. **Sem dependência nova:** `package.json` e `app.json` não mudam nesta fase. |
| 3 | Rebuild do dev client | Nenhum rebuild é exigido pela F6. Se o dev client instalado for anterior à F0 (sem os módulos nativos de câmera e vídeo), o rebuild deve ser combinado com o da F8 (SDK da Stripe). Nunca rodar build Android sem combinar. |
| 4 | Foto | **Foto e vídeo.** `mediaType: 'photo' \| 'video'`. A aba "Foto" da câmera usa `takePictureAsync`; a miniatura da galeria abre o `expo-image-picker` (já instalado) e recusa vídeo com mais de 30s. |
| 5 | feed-past-post (`2563:5334`) | **Estado do feed depois de publicar.** É idêntico ao feed no screenshot e na metadata. Após "Publicar agora" a tela faz `router.replace` para o feed, com o post novo no topo e o anel do "Seu story" ativo. Sem tela nova. |
| 6 | Feed do lojista | **Mostra todas as lojas** (mesmo feed do cliente). Curtir, Seguir e Compartilhar funcionam; **"Agendar" não aparece** (lojista não agenda como cliente). Nos posts próprios não aparece "Seguir". |
| 7 | Vincular serviço | **Serviços reais do Supabase** do lojista logado (mesma query de `app/(merchant)/services/index.tsx`). O post mock guarda um snapshot `{ serviceId, name, priceCents, durationMinutes }`. As categorias (chips) vêm do `FeedService` (lista fixa no mock; F8 vira tabela). |
| 8 | Entradas | Item **"Feed"** nos dois drawers (aditivo) e o toque na **`StoriesRow` da home do cliente**, que empurra `/(client)/feed?businessId=X`. O feed abre o visualizador se essa loja tiver story; se não tiver, mostra o feed normal. Robusto mesmo quando as lojas reais da home não existem nas fixtures. |
| 9 | "Agendar" (cliente) | Empurra `/(client)/store/[businessId]` (fluxo da F5, sem editar nada dele). Ids de fixture podem não existir no banco de dev; nesse caso a loja mostra o "Loja não encontrada" que já existe. Dívida F8. |
| 10 | "Ver todos" (preview) | Volta ao feed sem publicar (descarta o rascunho). |
| 11 | Fronteira do serviço | **Interface nova em arquivo próprio** (`lib/services/feedTypes.ts`), como o `bookingTypes.ts` da F5. `lib/services/types.ts` intocado (a F8 está mudando os contratos); consumidores importam direto de `feedTypes`. |
| 12 | Tab bar na câmera | A tela de gravação renderiza a câmera dentro de um `Modal` em tela cheia, que cobre a tab bar do lojista sem tocar em `MerchantCustomTabBar` (fora do território). |

## 2. Frames do Figma x telas

| Frame | Node | Tela | Conteúdo |
|---|---|---|---|
| feed (lojista) | `2485:146` | `app/(merchant)/feed/index.tsx` | Top bar navy com botão voltar circular (`button-contained` 48), fila de stories com "Seu story" (anel + badge "+"), lista vertical de cards 342x524 (gap 16) com avatar da loja, @handle, "serviço · data", "Seguir" (vermelho) e trilho lateral: curtir com contagem, "Agendar", "Compart.". Fundo gradiente navy. |
| feed-past-post | `2563:5334` | idem | Estado após publicar (decisão #5). |
| record-video-post | `2501:396` | `app/(merchant)/feed/record.tsx` | Câmera 390x610, fechar (X), pílula do timer "00:00 / 00:30" com ponto vermelho, abas "Foto"/"Vídeo", barra de progresso da gravação (280x4), miniatura da galeria, botão gravar (80, anel branco + quadrado vermelho), virar câmera. |
| preview-post | `2502:396` | `app/(merchant)/feed/preview.tsx` | Player 350x200 com play e "00:24 / 00:30", campo "Legenda", "Categoria do serviço" (chips roláveis), "Vincular serviço" (nome, "R$ 80 • 60 min", "Alterar"), toggles "Permitir downloads" e "Compartilhar com clientes vinculados", CTA "Publicar agora" (navy, 52) e "Ver todos" (ghost). |
| feed (cliente) | `2643:7839` | `app/(client)/feed/index.tsx` | Igual ao do lojista, sem "Seu story". |

## 3. Domínio: `FeedService` (`lib/services/feedTypes.ts`)

```ts
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
  'author' | 'mediaType' | 'mediaUri' | 'durationSec' | 'caption' | 'category' | 'linkedService' | 'allowDownloads' | 'shareWithLinkedClients'
>;

export const MAX_VIDEO_SECONDS = 30;
export const STORY_WINDOW_MS = 24 * 60 * 60 * 1000;

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
```

**`MockFeedService`** (`lib/services/mock/mockFeedService.ts`): estado em memória, `latencyMs` default 0 e `SIMULATED_LATENCY_MS` exportado (padrão dos outros mocks), relógio injetável `now?: () => Date` para testar a janela de 24h, retornos sempre copiados (mutar o retorno não altera o estado). Fixtures com as lojas do Figma (Zara Moda, Bella Boutique, Varejo Silva, Mix Magazine, Ana Cabelos), datas relativas ao `now` (parte dentro de 24h, parte fora), contagens como 45.200. Mídia de fixture com URLs públicas de exemplo; NUNCA URLs de asset do Figma. Curtidas e "seguindo" ficam no mesmo singleton do app (sem distinção de usuário até a F8).

**Wiring (aditivo):** `feed` no `ServicesContext` (tipo, ref, singleton default, `useFeedService`) e override `feed` no `renderWithProviders`.

**Autor do post do lojista:** `useBusinessProfile()` (`id`, `business_name`, `logo_url`) mapeado por `toFeedAuthor()` em `lib/feed/author.ts`, com `buildHandle()` (camelCase sem acento).

## 4. Componentes (`components/feed/`)

- **`FeedStoriesRow`**: props `{ groups, ownStory?: { author, active } | null, onPressGroup, onPressOwn }`. "Seu story" primeiro (anel navy com badge "+", vermelho quando `active`); demais anéis vermelhos. Medidas do `StoriesRow` da F2 (anel 72, foto 62), que é o mesmo desenho. A `StoriesRow` da home não é tocada.
- **`FeedActionRail`**: props `{ liked, likeCount, onLike, onSchedule?, onShare }`. Botões circulares brancos 48; "Agendar" só quando `onSchedule` existe. Contagem por `formatCompactCount()` (`lib/feed/format.ts`): 999, "1,2k", "45,2k", "1,5 mi".
- **`FeedPostCard`**: props `{ post, isActive, following, showFollow, onToggleFollow, onLike, onSchedule?, onShare }`. Cartão 342x524 com raio 24. Vídeo: `VideoView` com player mudo e em loop, tocando só quando `isActive`; foto: `Image` cover. Rodapé com handle, "serviço · 12 mai" (`formatPostMeta()`), "Seguir"/"Seguindo".
- **`StoryViewer`**: modal em tela cheia `{ visible, group, onClose }`. Barras de progresso por post, avanço automático (vídeo ao terminar, foto em 5s), toque à esquerda/direita volta/avança, legenda sobre a mídia, fechar no fim.
- **`FeedScreen`**: tela compartilhada `{ role: 'client' | 'merchant', initialBusinessId?: number }`. Carrega feed, stories e seguindo; `FlatList` com `onViewableItemsChanged` (60% visível) define o card ativo; `Share.share` no compartilhar; abre o `StoryViewer` para `initialBusinessId` quando houver grupo; recarrega no foco (`useFocusEffect`) para refletir o post recém-publicado. Lojista: "Seu story" abre `/(merchant)/feed/record`; o anel fica ativo quando o próprio negócio tem post nas últimas 24h. Estados: carregando, erro (com "Tentar novamente"), vazio ("Nenhuma publicação ainda").
- **`CameraCapture`** (record): `CameraView` (`mode` picture/video, `facing`, `videoQuality="720p"`), timer e barra de progresso por intervalo de 1s, parada automática em 30s, galeria via `ImagePicker.launchImageLibraryAsync`. Permissões: pede câmera (e microfone no modo vídeo); negada mostra texto e botão "Permitir acesso" (estado não desenhado). Resultado: `router.push('/(merchant)/feed/preview', { uri, type, duration })`.
- **`PostComposer`** (preview): player ou foto, legenda (limite 300), chips de categoria, serviço vinculado (lista do Supabase num bottom sheet simples aberto por "Alterar"; default o primeiro), dois toggles (`Switch`), "Publicar agora" com estado "Publicando..." e "Ver todos".

## 5. Rotas

- `app/(client)/feed/index.tsx`: `<FeedScreen role="client" initialBusinessId={param} />`.
- `app/(merchant)/feed/index.tsx`: `<FeedScreen role="merchant" />`.
- `app/(merchant)/feed/record.tsx`: `CameraCapture` dentro de `Modal`; fechar faz `router.back()`.
- `app/(merchant)/feed/preview.tsx`: lê `uri`, `type`, `duration` dos params; sem params válidos volta ao feed. Publicar: `feed.publishPost` e `router.replace('/(merchant)/feed')`.
- Layouts: `Tabs.Screen` com `tabBarButton: () => null` para `feed/index` (nos dois grupos), `feed/record` e `feed/preview`, num bloco comentado "Feed F6" no fim da lista (como o QI).

## 6. Divergências deliberadas previstas

| # | Divergência | Razão |
|---|---|---|
| 1 | Bottom nav visível no feed e no preview | O Figma não tem; as telas empurradas do app mantêm a tab bar (padrão F1 a F5). A câmera cobre tudo (decisão #12) |
| 2 | Preview com `AppHeader` (Voltar) | O Figma usa a top bar de hub (menu + sino); precedente F4 #4 |
| 3 | "Seguindo" depois de seguir | Estado não desenhado |
| 4 | Contagem "45,2k" | Figma "45.2k"; vírgula decimal do pt-BR |
| 5 | Visualizador de story | Não desenhado (decisão #1); só tokens do tema |
| 6 | "Agendar" oculto no lojista | Decisão #6 |
| 7 | Legenda só no visualizador de story | O card do Figma não mostra legenda |
| 8 | Estados de permissão negada, carregando, erro e vazio | Não desenhados |
| 9 | Chips de categoria do mock | Figma mostra "Cabelo, Barba, Recuperação folicular, Corte máquina" como exemplo; a lista vem do `FeedService` |

## 7. Fluxos

```
Cliente: drawer "Feed" ou toque na StoriesRow da home (?businessId)
  → FeedScreen(client) → anel → StoryViewer
                       → card: curtir | seguir | Agendar → /(client)/store/[id] | compartilhar
Lojista: drawer "Feed" → FeedScreen(merchant)
  → "Seu story" → record (Modal + CameraView | galeria) → preview
  → "Publicar agora" → feed.publishPost → replace /(merchant)/feed (post no topo, anel ativo)
  → "Ver todos" → replace /(merchant)/feed (sem publicar)
```

## 8. Paralelismo: território, zonas compartilhadas e dependências cruzadas

**Território F6 (livre):** `app/(merchant)/feed/*`, `app/(client)/feed/*`, `components/feed/*`, `lib/feed/*`, `lib/services/feedTypes.ts`, `lib/services/mock/mockFeedService.ts`, `__mocks__/expo-camera.tsx`, `__mocks__/expo-video.tsx` (mocks na raiz valem automaticamente para toda a suíte; seguro porque nenhum código usa esses módulos hoje), testes novos. O `expo-image-picker` é mockado POR ARQUIVO de teste (`jest.mock`), porque um mock na raiz mudaria as suítes existentes que já o usam (edição de perfil, signup do lojista).

**Zonas compartilhadas (aditivo e mínimo):**

| Arquivo | Mudança |
|---|---|
| `context/ServicesContext.tsx` | + `feed` no tipo, ref, singleton default e hook `useFeedService` |
| `__tests__/test-utils.tsx` | + override e retorno `feed` |
| `app/(client)/_layout.tsx`, `app/(merchant)/_layout.tsx` | + bloco `Tabs.Screen` do feed |
| `components/layout/clientDrawerItems.ts`, `merchantDrawerItems.ts` | + item "Feed" (cliente depois de "Buscar serviços"; lojista depois de "Serviços", nas duas listas) |
| `app/(client)/home/index.tsx` | só o `onPressStore` da `StoriesRow` (aprovado em 2026-11-02) |

**NÃO tocar:** `lib/services/types.ts`, `components/payment/*`, `components/profile/*`, `app/(merchant)/profile/*`, schedule, wallet, financeiro, qi, aqui-agora, `app/_layout.tsx`, `supabase/*`, `package.json`, `app.json`, `components/home/StoriesRow.tsx`, tab bars.

**Dependências cruzadas:**
- **F7 (perfil do lojista):** se o profile-view mostrar posts, a F7 lê pela interface `FeedService` depois do merge da F6 (a F7 não cria o serviço). A F6 não toca `components/profile/*`.
- **F8:** `FeedService` vira Supabase (tabelas `feed_posts`, `feed_likes`, `feed_follows` + Storage, vídeo até 30s em 720p, posts permanentes). Nenhuma alteração da F6 em `types.ts`, `package.json` ou `app.json`, então não há conflito com o SDK da Stripe.

## 9. Testes e verificação

TDD por task (jest, `__tests__/`, `renderWithProviders`, `jest.mock('expo-router')` por arquivo, mock de `lib/supabase` no padrão de `__tests__/client-home-redesign.test.tsx` onde a tela lê Supabase):

- `mock-feed-service.test.ts`: ordem do feed, janela de 24h com relógio injetado, validações do publicar, curtir (alterna e conta), seguir, cópias defensivas.
- `feed-format.test.ts`, `feed-author.test.ts`: contagem compacta, meta "serviço · data", handle.
- `feed-stories-row.test.tsx`, `feed-action-rail.test.tsx`, `feed-post-card.test.tsx`, `story-viewer.test.tsx` (fake timers para os 5s da foto).
- `feed-screen.test.tsx`: cliente (Agendar navega, sem "Seu story", abre story por `initialBusinessId`), lojista (sem Agendar, "Seu story" navega para record, sem Seguir nos próprios), curtir e seguir, compartilhar, erro e vazio.
- `merchant-feed-record.test.tsx`: permissão negada, foto, gravar e parar, limite de 30s, galeria com vídeo longo recusado.
- `merchant-feed-preview.test.tsx`: serviços do Supabase, publicar com payload correto e `replace`, "Ver todos", params inválidos.
- `services-context.test.tsx` estendido (`useFeedService`), drawers e home (`onPressStore` empurra a rota).

Mocks: `__mocks__/expo-camera.tsx` (`CameraView` com ref fake que expõe `takePictureAsync`/`recordAsync`/`stopRecording`, hooks de permissão controláveis) e `__mocks__/expo-video.tsx` (`useVideoPlayer` com `play`/`pause` espiões, `VideoView` como `View`). `expo-image-picker` via `jest.mock` no arquivo de teste.

Verificação: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`, `npx jest --maxWorkers=2` (suíte completa só nos marcos), lint sem problema novo, comparação visual contra os screenshots. Baseline medida no worktree em 02/11: 69 suítes, 525 testes.

## 10. Dívidas registradas para a F8

- `MockFeedService` em memória: posts publicados, curtidas e "seguindo" somem ao reiniciar o app e não distinguem usuário.
- Mídia publicada é a URI local do dispositivo; nada sobe. F8: upload ao Supabase Storage (720p, até 30s), capa gerada, posts permanentes.
- Ids de loja das fixtures podem não existir no banco de dev ("Agendar" cai em "Loja não encontrada").
- Categorias do composer são lista fixa do mock.
- "Permitir downloads" e "Compartilhar com clientes vinculados" só são gravados; o efeito (download no card, notificação aos clientes vinculados) chega com o backend.
- Link do compartilhar é provisório (sem deep link de post).
