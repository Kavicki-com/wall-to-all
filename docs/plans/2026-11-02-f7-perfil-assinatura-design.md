# F7: Perfil do lojista + Assinatura. Design

**Data:** 2026-11-02
**Fase:** 7 do novo escopo (`docs/plans/2026-07-06-novo-escopo-master.md`, § Fase 7)
**Branch:** `feat/f7-perfil-assinatura` (worktree `.worktrees/f7-perfil-assinatura`)
**Figma:** fileKey `c1QOl8EocqBiGd6R2NzrFn`. Profile (seção `2643:8170`): profile-view `2611:6893`, profile-stamps `2625:5970`. Assinatura (seção `2678:149`): subscription-offer `2678:150`, subscription-manage `2680:177`.
**Paralelismo:** F6 (feed) e F8 (pagamentos Stripe) rodam ao mesmo tempo em sessões separadas. Território e zonas compartilhadas na § 7.

A F7 evolui o perfil do lojista (selos e KPIs) e cria a assinatura do lojista (oferta e gerenciamento), UI-first com mocks. A assinatura é consumida depois pela Task 17 da F8 (Stripe Billing, só cartão), que troca o mock por uma implementação Stripe sem tocar em tela.

---

## 1. Decisões (2026-11-02)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Dependência da F6 | **Nenhuma.** O profile-view (`2611:6893`) não mostra posts do feed. Nenhum placeholder nem leitura de `FeedService`. |
| 2 | Quem cobra a assinatura | **O `SubscriptionService`.** A tela chama `subscribe(card)` e recebe a assinatura `active` ou `incomplete`. Espelha o Stripe Billing (`payment_behavior: 'default_incomplete'`), em que a Stripe cobra a fatura. A alternativa (tela cobra com `wallet.payWithCard` e depois ativa) viraria cobrança dupla na F8. |
| 3 | Fronteira do serviço | **Interface em arquivo próprio** (`lib/services/subscriptionTypes.ts`), sem tocar `lib/services/types.ts` (a F8 está mudando os contratos). Consumidores importam direto de `subscriptionTypes`. |
| 4 | Status | `active`, `past_due`, `canceled`, `incomplete` (os que a Task 17 da F8 mapeia) + `cancelAtPeriodEnd`. Cancelamento vale no fim do período. |
| 5 | Pix na assinatura | **Não existe no Figma.** Oferta e gerenciamento só falam em cartão; nenhuma divergência com a F8 (Stripe não faz Pix recorrente). |
| 6 | Valor e plano | **Os do mock**, iguais ao Figma: "Wall to All Premium", "PLANO ÚNICO", R$ 29,90/mês. Decisão "S" do design da F8 continua pendente; o valor vive só no mock. |
| 7 | Rotas da assinatura | **Uma rota hub** `app/(merchant)/assinatura/index.tsx`. Sem assinatura, `canceled` ou `incomplete` → visão Oferta; `active` ou `past_due` → visão Gerenciar. Top bar com menu nas duas, sem "Voltar". |
| 8 | Cancelamento | **Modal de confirmação + reativação.** `cancel()` liga `cancelAtPeriodEnd`; o card mostra "CANCELAMENTO AGENDADO" e "Acesso até ..."; o botão vira "Manter assinatura" (`resume()`). |
| 9 | KPIs do perfil | **Loader extraído** da home do lojista (F2) para `lib/merchant/merchantKpis.ts`, movido como está e coberto por teste de caracterização ANTES da extração. Home e perfil consomem dele. |
| 10 | Selos | **Mock fixo** atrás de interface (`ProfileStampsService` em `lib/services/profileTypes.ts`), os dois acesos como no Figma. Critério real é decisão de negócio pendente. |
| 11 | Endereço no perfil | **Sai do perfil do lojista** (o frame 🆕 não tem). `ProfileAddressCard` continua existindo e a loja do cliente (F5) segue usando. |
| 12 | Sem cartão salvo | CTA de assinar desabilitado + aviso "Nenhum cartão salvo". O lojista não tem rota de cadastro de cartão e a F8 (Task 14) refaz o cadastro. Dívida registrada. |
| 13 | Componentes de pagamento | **Consumidos sem edição:** `CardSelectionBottomSheet` e `PaymentProcessingSheet` (F5). `WalletService` só via `useWalletService().getCards()`. |

## 2. Frames do Figma x telas

Comparação feita com screenshot e metadata de cada node (02/11) contra o código da main (`4cca553`).

| Frame | Node | Tela | Veredito |
|---|---|---|---|
| profile-view | `2611:6893` | `app/(merchant)/profile/index.tsx` | **Evolui.** Já tem bricks, hero, ratings + preço médio, pagamentos, horário, "Editar Perfil", "Serviços" e "Cadastrar novo serviço". Entram: fileira de selos (`stamps`, 2 x 64px) entre hero e ratings, e `kpi-row (🆕)` com 4 cards roláveis na horizontal (Agendamentos, Avaliação, Indicações, Novos clientes; 124 x 111, gap 8). Sai: card de endereço (decisão #11). |
| profile-stamps | `2625:5970` | (não existe) | **Novo:** componente com 2 selos (`5-star-stamp`, `full-schedule-stamp`) x 2 estados (`active` dourado, `disable` cinza). Ilustrações exportadas do Figma como PNG. |
| subscription-offer | `2678:150` | (não existe) | **Novo:** visão Oferta da rota hub. Card navy do plano (badge "PLANO ÚNICO", nome, descrição, "R$ 29,90 /mês"), "O que está incluso" (6 itens com check verde), box "Cancele quando quiser", CTA navy "Assinar por R$ 29,90/mês", link "Termos do plano e política de cobrança". |
| subscription-manage | `2680:177` | (não existe) | **Novo:** visão Gerenciar. Card navy de status (badge "ATIVO", nome, "R$ 29,90 · cobrado mensalmente", pílula "Próxima cobrança em 14 jun 2026"), "Forma de pagamento" (linha "Pagamento com Cartão", •••• last4, bandeira, "Alterar >"), "Histórico de cobranças" (data, valor, badge "Pago"), "Ver todas as faturas", botão outline "Cancelar assinatura". |

## 3. Contrato da assinatura

### 3.1 `SubscriptionService` (`lib/services/subscriptionTypes.ts`)

```ts
import type { CardBrand, PaymentCard } from './types';

/** Espelha os status que a Task 17 da F8 mapeia a partir do Stripe Billing. */
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete';
/** 'open' = fatura emitida e não paga (pendente ou tentativa recusada). */
export type SubscriptionInvoiceStatus = 'paid' | 'open';

export interface SubscriptionPlan {
  id: string;
  name: string;          // "Wall to All Premium"
  badge: string;         // "PLANO ÚNICO"
  description: string;   // "Acesso completo à plataforma para o seu negócio crescer."
  priceCents: number;    // 2990
  interval: 'month';
  features: string[];    // "O que está incluso"
}

export interface SubscriptionCard {
  id: string;
  brand: CardBrand;
  last4: string;
}

export interface Subscription {
  id: string;
  planId: string;
  priceCents: number;
  status: SubscriptionStatus;
  /** true = cancelada pelo lojista, mas ainda 'active' até currentPeriodEnd. */
  cancelAtPeriodEnd: boolean;
  /** ISO 8601: próxima cobrança, ou fim do acesso quando cancelAtPeriodEnd. */
  currentPeriodEnd: string;
  card: SubscriptionCard | null;
}

export interface SubscriptionInvoice {
  id: string;
  amountCents: number;
  status: SubscriptionInvoiceStatus;
  /** ISO 8601 da emissão. */
  createdAt: string;
}

export interface SubscriptionService {
  getPlan(): Promise<SubscriptionPlan>;
  /** null = nunca assinou. */
  getSubscription(): Promise<Subscription | null>;
  /** Cobra a 1ª fatura no cartão. Recusa NÃO lança: devolve status 'incomplete'. Já 'active' → lança. */
  subscribe(card: PaymentCard): Promise<Subscription>;
  /** Troca o cartão. Em 'past_due', tenta cobrar a fatura aberta (aprovado → 'active'). */
  updatePaymentCard(card: PaymentCard): Promise<Subscription>;
  /** Liga cancelAtPeriodEnd (idempotente). Sem assinatura ativa → lança. */
  cancel(): Promise<Subscription>;
  /** Desliga cancelAtPeriodEnd (idempotente). Sem assinatura ativa → lança. */
  resume(): Promise<Subscription>;
  /** Mais recente primeiro. */
  getInvoices(): Promise<SubscriptionInvoice[]>;
}
```

`subscribe` e `updatePaymentCard` recebem o `PaymentCard` inteiro porque o mock precisa de bandeira e últimos dígitos para exibir; a implementação Stripe usa só `card.id` (id do PaymentMethod) e lê os dados do cartão da resposta do servidor.

### 3.2 Mock (`lib/services/mock/mockSubscriptionService.ts`)

- Estado em memória, `delay()` como os outros mocks, `SIMULATED_LATENCY_MS` exportado.
- Opções: `{ latencyMs?: number; initial?: 'none' | 'active' | 'past_due' | 'canceling'; declineCardIds?: string[]; now?: () => Date }`.
- `initial` default `'none'`: o app abre na Oferta. `'active'` semeia assinatura com cartão `•••• 4242` e 4 faturas pagas mensais; `'past_due'` semeia com a fatura mais recente `open`; `'canceling'` = `'active'` com `cancelAtPeriodEnd`.
- `subscribe`: cartão em `declineCardIds` → `incomplete` + fatura `open`; senão `active`, `currentPeriodEnd` = agora + 1 mês, fatura `paid`. Uma assinatura `incomplete` ou `canceled` é substituída por uma nova.
- Plano fixo do Figma (§ 2).

### 3.3 Selos (`lib/services/profileTypes.ts`)

```ts
export type ProfileStampId = 'five_stars' | 'full_schedule';
export interface ProfileStamp { id: ProfileStampId; label: string; earned: boolean }
export interface ProfileStampsService { getStamps(): Promise<ProfileStamp[]> }
```

Mock `lib/services/mock/mockProfileStampsService.ts`: os dois selos com `earned: true` (como no Figma), opção `earned?: ProfileStampId[]` para os testes.

### 3.4 Injeção

`context/ServicesContext.tsx`: + `subscription` e `stamps` no tipo, refs, singletons default e hooks `useSubscriptionService` / `useProfileStampsService`. `__tests__/test-utils.tsx`: + overrides e retorno `subscription` / `stamps`. Ambos aditivos.

## 4. Perfil do lojista

### 4.1 KPIs (`lib/merchant/merchantKpis.ts`)

Move da home (`app/(merchant)/home/index.tsx`) a parte que calcula os 4 KPIs, sem mudar comportamento: janela mês anterior → mês corrente, filtro `confirmed`/`completed`, contagem com delta percentual, média de avaliações (sem delta), indicações do `QiService` (sem delta) e novos clientes com delta absoluto. A home continua calculando meta, donut e próximos agendamentos com as mesmas linhas; o loader expõe tanto a função pura de cálculo (`computeMerchantKpis(rows, ...)`) quanto o carregador (`loadMerchantKpis(businessId, qiService)`), para a home reaproveitar as linhas de métricas que já busca sem fazer consulta duplicada.

Ordem: (1) teste de caracterização do cálculo com as linhas que a home recebe; (2) extração; (3) home consome; (4) testes atuais da home continuam verdes sem alteração.

### 4.2 Tela

- `ProfileStampsRow` (`components/profile/ProfileStampsRow.tsx`, novo): props `{ stamps: ProfileStamp[] }`, 64 x 64, gap 8, imagem ativa ou cinza por `earned`, `accessibilityLabel` com o rótulo e o estado.
- Fileira de KPIs: `ScrollView` horizontal com `KpiCard` (F2, consumido sem alteração; `style` com largura 124). Ícones: calendário, estrela, aperto de mão, conta.
- Card de endereço removido do perfil do lojista.
- Falha no loader de KPIs: valores default ("0", e o placeholder de nota que a home já usa, escrito na fonte como a constante `NO_RATING = '\u2014'`), log, resto da tela intacto (como a home). Falha nos selos: fileira não renderiza.

## 5. Assinatura

### 5.1 Rota hub e casca

`app/(merchant)/assinatura/index.tsx`: `HomeTopBar` (menu → `AppDrawer` com `MERCHANT_DRAWER_ITEMS`, sino → `NotificationModal`), como o Financeiro, com o título "Minha assinatura" no corpo da tela (divergência #11). Carrega plano, assinatura, faturas e cartões; escolhe a visão pelo mapa da decisão #7. Loading com spinner; erro de carga com toast e botão "Tentar novamente".

### 5.2 Oferta (`components/subscription/SubscriptionOfferView.tsx`)

Props `{ plan, onSubscribe, subscribeDisabled, noCardHint, onOpenTerms }`. Fluxo de assinar, orquestrado pela tela:

1. CTA → `CardSelectionBottomSheet` com `wallet.getCards()` (cartão default à frente).
2. "Selecionar cartão" → `PaymentProcessingSheet` + `Promise.all([subscription.subscribe(card), delay(PROCESSING_MIN_MS)])`.
3. `active` → toast "Assinatura ativada", recarrega (cai no Gerenciar). `incomplete` → toast "Pagamento recusado. Tente outro cartão.", continua na Oferta. Exceção → toast de erro genérico.

Sem cartão salvo: CTA desabilitado e aviso "Nenhum cartão salvo" (decisão #12). Termos: `router.push('/(merchant)/settings/terms')`.

### 5.3 Gerenciar (`components/subscription/SubscriptionManageView.tsx`)

- `SubscriptionStatusCard`: badge por estado ("ATIVO" verde; "PAGAMENTO PENDENTE" vermelho; "CANCELAMENTO AGENDADO" cinza), nome do plano, "R$ 29,90 · cobrado mensalmente", pílula "Próxima cobrança em 14 jun 2026" ou "Acesso até 14 jun 2026". Em `past_due`, linha extra "Atualize a forma de pagamento para manter o acesso.".
- "Forma de pagamento": `SubscriptionPaymentRow` ("Pagamento com Cartão", `•••• last4`, `CardBrandFlag`, "Alterar >") → `CardSelectionBottomSheet` → `updatePaymentCard` (com `PaymentProcessingSheet` em `past_due`, porque há cobrança).
- "Histórico de cobranças": `SubscriptionInvoiceList` com as 4 mais recentes (data, valor, badge "Pago" verde ou "Pendente" vermelho). "Ver todas as faturas" expande a lista na tela e some quando não há mais.
- "Cancelar assinatura" (outline) → modal de confirmação "Cancelar assinatura?" com o texto "Você mantém o acesso até 14 jun 2026." → `cancel()`. Com `cancelAtPeriodEnd`, o botão vira "Manter assinatura" → `resume()`.

### 5.4 Formatação

`lib/subscription/formatDate.ts`: `formatSubscriptionDate(iso)` → "14 jun 2026" (mês abreviado minúsculo, sem ponto, pt-BR, independente do locale do dispositivo). Valores com `formatBRL`.

### 5.5 Entrada

- `components/layout/merchantDrawerItems.ts`: + `{ label: 'Assinatura', route: '/(merchant)/assinatura' }` logo depois de "Perfil" (vale para as duas listas, que compartilham o pedaço).
- `app/(merchant)/_layout.tsx`: + `Tabs.Screen name="assinatura/index"` oculto.

## 6. Divergências deliberadas previstas

| # | Divergência | Razão |
|---|---|---|
| 1 | Bottom nav do lojista nas telas de assinatura | O Figma usa a nav do cliente (com lupa) nos frames da assinatura |
| 2 | Gerenciar sem "Voltar" | Visão da rota hub (decisão #7) |
| 3 | Selos de mock fixo | Critério de negócio indefinido (decisão #10) |
| 4 | Avaliação e Indicações sem variação | Herdado da home (F2): o mock do QI não tem série mensal e a média por período exige reviews datadas |
| 5 | Linha de pagamento com o cartão real do mock (•••• 4242) | O Figma traz "0928" estático (precedente F5 #5) |
| 6 | Estados `past_due`, cancelamento agendado, modal de cancelar, toasts e "Nenhum cartão salvo" | Não desenhados |
| 7 | "Ver todas as faturas" expande na própria tela | Não há frame de lista completa |
| 8 | Sheet de cartão com os textos da F5 ("Meus cartões" / "Selecionar cartão") | `components/payment/*` não pode ser alterado nesta fase |
| 9 | Perfil sem card de endereço | O frame 🆕 não tem; a loja do cliente mantém |
| 10 | "Processando..." com duração mínima simulada | O mock responde na hora (precedente F5 #13) |
| 11 | "Minha assinatura" como título no corpo da tela, não dentro da top bar | A `HomeTopBar` (casca das telas-hub, como no Financeiro) não tem slot de título; alterá-la mexeria em componente compartilhado de outras fases |
| 12 | Selos em SVG, não PNG | O export PNG do Figma vem com fundo opaco do canvas; os SVGs são importados só via `components/profile/stampArt.ts` (um único módulo para mockar nos testes) |
| 13 | Card de formas de pagamento antes do card de horário no perfil | Segue a ordem do frame `2611:6893`; a tela anterior tinha a ordem inversa |
| 14 | Linha de preço do card de status com o separador "•" ("R$ 29,90 • cobrado mensalmente") | Diverge do texto do Figma; mantido por legibilidade da linha única |
| 15 | Brilho radial do card de status e da oferta simplificado para gradiente linear | Simplificação visual com `expo-linear-gradient`, já usado nos cards; o radial exigiria um `RadialGradient` SVG dimensionado por card |

## 7. Paralelismo: território, zonas compartilhadas e dependências cruzadas

**Território F7 (livre):** `app/(merchant)/profile/*`, `app/(merchant)/assinatura/*`, `components/subscription/*`, `lib/services/subscriptionTypes.ts`, `lib/services/mock/mockSubscriptionService.ts`, `lib/services/profileTypes.ts`, `lib/services/mock/mockProfileStampsService.ts`, `lib/subscription/*`, `lib/merchant/*`, `assets/stamps/*`, testes novos.

**Zonas compartilhadas tocadas (aditivo e mínimo):**

| Arquivo | Mudança |
|---|---|
| `context/ServicesContext.tsx` | + `subscription` e `stamps` no tipo, refs, singletons e hooks |
| `__tests__/test-utils.tsx` | + overrides e retorno `subscription` / `stamps` |
| `components/profile/ProfileStampsRow.tsx` | arquivo novo; demais `components/profile/*` sem mudança |
| `components/layout/merchantDrawerItems.ts` | + item "Assinatura" |
| `app/(merchant)/_layout.tsx` | + `Tabs.Screen` oculto `assinatura/index` |
| `app/(merchant)/home/index.tsx` | só troca o cálculo inline dos KPIs pela chamada a `lib/merchant/merchantKpis.ts` (decisão #9). Fora do território original: risco de conflito se a F6 mexer na home |
| `lib/services/types.ts`, `components/payment/*`, `app/_layout.tsx`, `supabase/*` | **sem mudança** |

**Dependências cruzadas:**

- **F8 Task 17:** consome `SubscriptionService` e `subscriptionTypes.ts`. Status batem com o mapa da task. `subscribe` não lança em recusa porque o Billing também devolve `incomplete`. `resume()` é método a mais que a task não previa: mapeia para `cancel_at_period_end: false`. A Task 17 troca o mock em `ServicesContext` pela seleção por `EXPO_PUBLIC_PAYMENTS_PROVIDER`, como as outras.
- **F8 Tasks 10/14 (sheets e cadastro de cartão):** a F7 só importa `CardSelectionBottomSheet` e `PaymentProcessingSheet`. Se a F8 mudar as props, o rebase ajusta as chamadas.
- **F6:** sem sobreposição de tela. Possível conflito em `ServicesContext`, `test-utils`, layout e drawer (manter as adições das duas fases) e na home do lojista, se a F6 também a alterar.

## 8. Testes e verificação

TDD por task (jest, `__tests__/`, `renderWithProviders`; `jest.mock('expo-router')` por arquivo; mock de `lib/supabase` no padrão `client-home-redesign` onde a tela lê Supabase):

- `mock-subscription-service.test.ts`: estados iniciais, assinar (aprovado e recusado), substituição de `incomplete`, `past_due` → trocar cartão → `active`, cancel/resume idempotentes, erros sem assinatura, faturas em ordem.
- `mock-profile-stamps-service.test.ts`, `subscription-format-date.test.ts`.
- `merchant-kpis.test.ts`: caracterização (contagem e delta %, média, indicações, novos clientes e delta absoluto, status fora do filtro, mês vazio).
- `profile-stamps-row.test.tsx`, `merchant-profile-view.test.tsx` (selos, 4 KPIs, sem endereço, serviços).
- `subscription-offer-view.test.tsx`, `subscription-manage-view.test.tsx` (badges por estado, pílula, faturas expandindo, botão cancelar/manter).
- `merchant-subscription-screen.test.tsx` (hub: escolha da visão por estado; assinar aprovado e recusado; sem cartão; alterar cartão; past_due voltando a active; cancelar com confirmação; manter).
- Drawer: teste dos itens do lojista com "Assinatura".
- Regressão: testes atuais da home do lojista e da loja do cliente verdes sem alteração.

Verificação: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`, `npx jest --maxWorkers=2`, lint sem problema novo, comparação visual contra os screenshots. Baseline medida no worktree em 02/11: 69 suítes, 525 testes.

## 9. Dívidas registradas para a F8

- `MockSubscriptionService` é em memória: a assinatura some ao reiniciar o app. F8 Task 17: tabela `subscriptions` + Stripe Billing + webhook.
- Lojista sem rota de cadastro de cartão: com a carteira vazia não há como assinar. F8 Task 14 refaz o cadastro (`CardField` + SetupIntent); criar a entrada do lojista ali.
- Selos com critério indefinido (mock fixo). Definir a regra de negócio e calcular a partir de dados reais.
- KPIs sem variação para Avaliação e Indicações (herdado da F2).
- Valor e plano da assinatura (decisão "S" da F8) só no mock.
- "Ver todas as faturas" sem paginação: o mock devolve tudo de uma vez; com Stripe, paginar `invoices.list`.
