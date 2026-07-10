# F2 (Dashboards/Home novos) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesenhar a home do cliente (Figma `2715:3426`) e a home/dashboard do lojista (Figma `2478:111`) no novo design system, integrando os drawers (F0) à navegação principal dos dois lados.

**Architecture:** ⚠️ **Diferente da F1 (mock-first): a F2 é um REDESIGN de telas já conectadas ao Supabase real.** `app/(client)/home/index.tsx` e `app/(merchant)/home/index.tsx` já carregam agendamentos, negócios, serviços e métricas reais — o redesign PRESERVA essas fontes de dados e troca só a camada visual. Nada de mock novo para dado que já existe; decorativo apenas o que não tem backend (interação de stories → F6, FAB de posts → F6). Lógica de métricas nova vai para helpers puros (`lib/dashboardMetrics.ts`) — fáceis de testar sem Supabase.

**Tech Stack:** Expo + expo-router · Supabase (telas existentes, queries reais) · react-native-svg 15.12.1 (donut) · jest + @testing-library/react-native · tokens de `lib/theme.ts` · componentes F0 (`TopBar`, `AppDrawer`, tab bars, `Chip`).

**Referência de escopo:** `docs/plans/2026-07-06-novo-escopo-master.md` (§ Fase 2).

**Branch:** criar `feat/f2-dashboards-home` **a partir de `feat/f0-f1-aqui-e-agora`** (stacked) — os componentes F0 (TopBar/AppDrawer/tab bars) ainda não estão em `main`. Se o PR da F0/F1 já tiver sido mergeado, partir de `main`.

**Convenções que valem para TODAS as tarefas** (herdadas do plano F0/F1):
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` (OOM sem isso).
- Suíte autoritativa no Windows: `npx jest --maxWorkers=2` (o `npm test` pode acusar "failed suites" fantasma com 0 testes falhos — flake de teardown de worker).
- Cores/espaçamentos: tokens de `lib/theme.ts`. Token novo do Figma → adicionar ao theme, nunca hex inline. Tokens já existentes que a F2 usa: `brand`, `accent`, `surfaceSuccess`, `contentWarning`, `contentInfo`, `surfacePrimaryExtraLight`, `surfaceGrey`, `contentLight`, `textPrimary`, `textSecondary`, `neutral400`.
- Montserrat apenas (`Montserrat_700Bold`/`_600SemiBold`/`_500Medium`/`_400Regular`). Copy e comentários em pt-BR.
- Commits sem atribuição de AI.
- Antes de implementar cada tela: `mcp__claude_ai_Figma__get_design_context` com o nodeId indicado (fileKey `c1QOl8EocqBiGd6R2NzrFn`) e usar o screenshot como referência de fidelidade.
- **NUNCA usar URLs de asset do Figma no código.** Imagens reais vêm do Supabase (`logo_url`/`banner_url`/`photos`); sem imagem → bloco de cor/iniciais decorativo.
- Testes de tela: mockar o módulo `lib/supabase` no escopo do módulo de teste (seguir o padrão dos testes existentes que mockam supabase, ex.: testes de signup). Manter os testes de tela enxutos; a lógica pesada vive nos helpers puros e componentes (testados isoladamente).

---

## Decisões de produto registradas (não re-litigar; validar com o Gabriel só se algo contradizer o Figma)

1. **"Visão do mês" — a meta é a receita do mês anterior.** Não existe tabela de meta e Supabase novo só na F8. `Previsão` = receita total do mês anterior (benchmark real e honesto: "repetir o mês passado"); `Realizado` = receita do mês corrente; `Faltam` = max(0, previsão − realizado); `%` = realizado/previsão. Caption verde "você está em dia!" quando o % realizado ≥ % do mês decorrido. Mês anterior sem receita → cartão mostra estado neutro ("Sem histórico do mês anterior ainda") sem barra de progresso. Meta configurável pelo lojista fica para quando houver backend (F8+).
2. **Deltas dos KPIs = comparação real com o mês anterior** (agendamentos, novos clientes, indicações: variação absoluta ou %; avaliação: delta absoluto, ex. +0.2). Sem dado do mês anterior → badge oculto (não inventar tendência).
3. **Stories da home cliente usam os negócios em destaque reais** (logo_url + business_name dos featured) — o anel é visual novo; o TAP é no-op com `TODO(F6): abrir feed/stories`. Nada de conteúdo fake.
4. **FAB de posts do dashboard lojista (Figma `2560:4953`) fica FORA da F2** — criação de post é F6 (feed). Documentar no código da tela com TODO(F6).
5. **Seções "Meus Serviços" e "Compartilhar perfil" saem da home do lojista** (o Figma não as mostra); o acesso migra para o drawer (itens "Serviços" e "Compartilhar perfil" → rotas existentes `/(merchant)/services` e `/(merchant)/home/share`).
6. **Preço médio "$$$"** do store-highlight-card: média de `services[].price` do negócio bucketed em 5 níveis — ≤50 → $, ≤100 → $$, ≤150 → $$$, ≤250 → $$$$, senão $$$$$. Sem serviços com preço → linha oculta.
7. **Drawers na navegação (escopo F2 do master):** o menu (hambúrguer) da TopBar das duas homes abre o `AppDrawer` (F0). Itens cliente: Início, Meus agendamentos, Buscar serviços, Perfil, Configurações. Itens lojista: os mesmos do drawer do aqui-agora (`app/(merchant)/aqui-agora/index.tsx` `drawerItems`) + "Compartilhar perfil". O sino reaproveita o fluxo de notificações existente do `AppHeader`.

---

## Task 1: Helpers puros de métricas (`lib/dashboardMetrics.ts`)

**Files:**
- Create: `lib/dashboardMetrics.ts`
- Test: `__tests__/dashboard-metrics.test.ts`

Funções puras — sem Supabase, sem React. Tipos de entrada minimalistas para não acoplar ao shape das queries.

**Step 1: Escrever os testes que falham** (`__tests__/dashboard-metrics.test.ts`):

```ts
import {
  computeMonthOverview,
  groupRevenueByService,
  computeDelta,
  priceTier,
} from '../lib/dashboardMetrics';

describe('computeMonthOverview', () => {
  it('usa a receita do mês anterior como meta e calcula faltam/percentual', () => {
    const o = computeMonthOverview({ currentRevenue: 4250, previousRevenue: 6000, dayOfMonth: 22, daysInMonth: 31 });
    expect(o).toEqual({ forecast: 6000, realized: 4250, remaining: 1750, pct: 71, onTrack: true });
    // onTrack: 71% realizado ≥ 71% do mês decorrido (22/31 ≈ 71%).
  });
  it('marca fora do ritmo quando o % realizado fica abaixo do % do mês decorrido', () => {
    const o = computeMonthOverview({ currentRevenue: 1000, previousRevenue: 6000, dayOfMonth: 22, daysInMonth: 31 });
    expect(o!.onTrack).toBe(false);
  });
  it('retorna null sem receita no mês anterior (sem meta → estado neutro)', () => {
    expect(computeMonthOverview({ currentRevenue: 500, previousRevenue: 0, dayOfMonth: 5, daysInMonth: 30 })).toBeNull();
  });
});

describe('groupRevenueByService', () => {
  it('agrupa receita por serviço, ordena desc e agrega a cauda em "Outros" (máx. 3 + Outros)', () => {
    const rows = [
      { serviceName: 'Corte feminino', amount: 1912 },
      { serviceName: 'Corte masculino', amount: 1062 },
      { serviceName: 'Escovas', amount: 850 },
      { serviceName: 'Barba', amount: 300 },
      { serviceName: 'Sobrancelha', amount: 125 },
      { serviceName: 'Corte feminino', amount: 1 }, // soma no mesmo serviço
    ];
    const g = groupRevenueByService(rows);
    expect(g.total).toBe(4250);
    expect(g.segments.map((s) => s.label)).toEqual(['Corte feminino', 'Corte masculino', 'Escovas', 'Outros']);
    expect(g.segments[3].amount).toBe(425); // 300 + 125
    expect(g.segments[0].pct).toBe(45); // 1913/4250 ≈ 45
  });
  it('retorna total 0 e sem segmentos para lista vazia', () => {
    expect(groupRevenueByService([])).toEqual({ total: 0, segments: [] });
  });
});

describe('computeDelta', () => {
  it('variação absoluta e percentual vs período anterior', () => {
    expect(computeDelta(24, 21)).toEqual({ abs: 3, pct: 14, up: true });
    expect(computeDelta(18, 24)).toEqual({ abs: -6, pct: -25, up: false });
  });
  it('null quando não há base de comparação (prev 0/undefined)', () => {
    expect(computeDelta(10, 0)).toBeNull();
    expect(computeDelta(10, undefined)).toBeNull();
  });
});

describe('priceTier', () => {
  it('bucketiza a média de preços em 1..5 cifrões', () => {
    expect(priceTier([30, 40])).toBe(1);
    expect(priceTier([80])).toBe(2);
    expect(priceTier([120, 140])).toBe(3);
    expect(priceTier([200])).toBe(4);
    expect(priceTier([400])).toBe(5);
  });
  it('null sem preços', () => {
    expect(priceTier([])).toBeNull();
  });
});
```

**Step 2: Rodar e ver falhar** — `npx jest dashboard-metrics --maxWorkers=2` → FAIL (módulo não existe).

**Step 3: Implementar `lib/dashboardMetrics.ts`** (assinaturas; implementar o mínimo que passa):

```ts
export interface MonthOverviewInput { currentRevenue: number; previousRevenue: number; dayOfMonth: number; daysInMonth: number; }
export interface MonthOverview { forecast: number; realized: number; remaining: number; pct: number; onTrack: boolean; }
export function computeMonthOverview(i: MonthOverviewInput): MonthOverview | null { /* meta = receita do mês anterior */ }

export interface ServiceRevenueRow { serviceName: string; amount: number; }
export interface RevenueSegment { label: string; amount: number; pct: number; }
export function groupRevenueByService(rows: ServiceRevenueRow[]): { total: number; segments: RevenueSegment[] } { /* top 3 + "Outros" */ }

export function computeDelta(current: number, previous: number | undefined): { abs: number; pct: number; up: boolean } | null {}

export function priceTier(prices: number[]): 1 | 2 | 3 | 4 | 5 | null {}
```

**Step 4: Verde** — `npx jest dashboard-metrics --maxWorkers=2` → PASS. Typecheck limpo.

**Step 5: Commit** — `git commit -m "feat(dashboard): pure metric helpers for month goal, revenue grouping and deltas"`

## Task 2: `StoreHighlightCard` (home cliente)

**Files:**
- Create: `components/home/StoreHighlightCard.tsx`
- Test: `__tests__/store-highlight-card.test.tsx`

**Step 0:** `get_design_context` nodeId `2715:3469` (card dentro da home). Estrutura: hero image (banner) com gradiente navy por cima, avatar 56px sobreposto + nome (branco, bold 16) + descrição curta (branco, 8), linha "Preço médio" + cifrões (acesos em `accent`, apagados em `surfaceGrey`), chips de serviços (DS `Chip`, linha clipada), "Horário de funcionamento" + linha de dias/horas, "Pagamentos aceitos" + PIX/Cartão/Dinheiro.

**Props (dados reais do tipo `Business` de `lib/types.ts`):** `business: Business` + `onPress`. Campos: `banner_url`, `logo_url`, `business_name`, `description`, `services` (chips por `name`; preços → `priceTier` da Task 1), `work_days` (checar o tipo `WorkDays` em `lib/types.ts` e o formato usado nas telas de perfil para renderizar "Seg à Sex - 10h às 18h"), `accepted_payment_methods` (checar `AcceptedPaymentMethods`; renderizar só os aceitos). **Fallbacks obrigatórios:** sem banner/logo → bloco `surfaceGrey`/iniciais; sem preços → linha "Preço médio" oculta; sem work_days/pagamentos → seção oculta.

**Steps 1-4 (TDD):** testes: nome+descrição renderizam; cifrões refletem `priceTier` (ex.: 3 acesos de 5); chips das services aparecem; pagamentos mostram só os aceitos; fallbacks (sem banner → sem `Image` remota; sem preços → sem "Preço médio"); `onPress` dispara (card com `accessibilityRole="button"` e label pt-BR).

**Step 5: Commit** — `git commit -m "feat(home): store highlight card"`

## Task 3: `StoriesRow` (home cliente)

**Files:**
- Create: `components/home/StoriesRow.tsx`
- Test: `__tests__/stories-row.test.tsx`

**Step 0:** nodes `2715:3438..3458`. Anel 72px com borda `accent`, foto 62px dentro, nome (12, Medium) embaixo; linha com scroll horizontal.

**Props:** `stores: Array<{ id: number; name: string; logoUrl: string | null }>` + `onPressStore?` (default no-op). Dados vêm dos featured businesses REAIS da home. Tap: no-op com comentário `TODO(F6): abrir feed/stories do negócio`. Sem logo → círculo `surfacePrimaryExtraLight` com iniciais (mesmo padrão `getInitials` das telas F1).

**Steps 1-4 (TDD):** nomes renderizam; um item por store; iniciais quando `logoUrl null`; a11y (`accessibilityLabel` "Stories de {name}").

**Step 5: Commit** — `git commit -m "feat(home): stories row bound to featured businesses"`

## Task 4: Redesign da home do cliente

**Files:**
- Modify: `app/(client)/home/index.tsx` (manter TODO o `loadData`/queries/Cache; trocar só a camada visual)
- Test: `__tests__/client-home-redesign.test.tsx`

**Step 0:** `get_design_context` nodeId `2715:3426` (tela inteira) + screenshot.

**O que muda (de cima para baixo):**
1. `AppHeader` → **`TopBar`** (F0, `variant="brand"`): menu abre o **`AppDrawer`** (itens da decisão #7; `header` do drawer = saudação com o nome do usuário, se disponível); sino em `rightActions` → reaproveitar o fluxo de notificações que o `AppHeader` usa hoje (ver `components/layout/AppHeader.tsx` e `components/notifications/NotificationModal.tsx`).
2. Bloco de busca (fundo `surface`): combo "Procurar serviços" (borda 1px `textSecondary`, radius 24, lupa) → `router.push` para a rota de busca existente (`/(client)/search`); botão vermelho de filtro (56px, `accent`, radius 24) → navega para a busca com foco em filtros (ou stub documentado se a busca não tiver filtros); chips de categorias REAIS (as `categories` que a tela já carrega) → tap navega para busca/categoria (padrão atual da home).
3. **`StoriesRow`** com os featured businesses reais.
4. "Meus Agendamentos" (`accent`, bold 16): mantém os agendamentos reais + `AppointmentCard` existente; empty state NOVO do Figma — cartão de borda TRACEJADA (`surfaceGrey`) com "Você ainda não tem nenhum agendamento, agende um serviço para visualizar eles aqui:".
5. "Lojas em destaque": FlatList horizontal de **`StoreHighlightCard`** (largura 255) com os featured reais; tap → rota da loja existente (`/(client)/store/[id]`).
6. "Serviços mais contratados": manter o `ServiceCard` existente (o card do Figma é o mesmo componente da biblioteca) com os popular services reais.
7. Botão outline "Agendar serviços" (borda `brand`, radius 24) → rota de busca/agendamento existente.

**Steps 1-4 (TDD):** mockar `lib/supabase` no módulo de teste (padrão dos testes de signup) devolvendo fixtures mínimas (1 agendamento, 2 featured, 2 services, 3 categorias). Testes: (a) seções novas renderizam com os dados mockados (stories + destaque + serviços); (b) empty state tracejado aparece sem agendamentos; (c) menu abre o drawer (testID no botão do menu; `AppDrawer` visível); (d) combo de busca navega (`mockPush`). Antes de mexer, rodar qualquer teste existente da home para conhecer o baseline.

**Step 5: Fidelidade** — screenshot do Figma vs tela; conferir tokens/fontes.

**Step 6: Commit** — `git commit -m "feat(client): redesigned home with stories, highlights and drawer"`

## Task 5: `GoalOverview` + `KpiCard` (dashboard lojista)

**Files:**
- Create: `components/dashboard/GoalOverview.tsx`
- Create: `components/dashboard/KpiCard.tsx`
- Test: `__tests__/dashboard-cards.test.tsx`

**Step 0:** nodes `2478:181` (goal-overview) e `2482:2` (kpi-row).

**`GoalOverview` props:** `overview: MonthOverview | null` (Task 1) + `onPress?` (chevron do "Visão do mês" → tela de métricas existente, se houver rota; senão no-op documentado). Renderiza: header "Visão do mês" (accent, bold) + chevron; 3 stats (Previsão/Realizado/Faltam — `formatBRL` de `lib/formatters`); barra de progresso (track `surfaceGrey`, fill `surfaceSuccess`, largura = pct); caption com bolinha verde "X% da meta — você está em dia!" (variação "fora do ritmo" em `contentWarning` quando `!onTrack`). `overview null` → estado neutro "Sem histórico do mês anterior ainda".

**`KpiCard` props:** `icon: React.ReactNode; label: string; value: string; delta: { text: string; up: boolean } | null`. Cartão branco, radius 4, sombra leve, badge de delta verde (`surfaceSuccess`) com seta ↑ (ou `accent`/↓ quando negativo); `delta null` → badge oculto.

**Steps 1-4 (TDD):** GoalOverview mostra os 3 valores formatados + caption certa conforme `onTrack`; estado neutro sem overview; KpiCard mostra label/valor e esconde o badge com delta null.

**Step 5: Commit** — `git commit -m "feat(dashboard): goal overview and kpi cards"`

## Task 6: `RevenueDonut` (dashboard lojista)

**Files:**
- Create: `components/dashboard/RevenueDonut.tsx`
- Test: `__tests__/revenue-donut.test.tsx`

**Step 0:** node `2478:200` (donut-card). Donut 110px + label central ("Total" + `formatBRL(total)`) + legenda à direita (bolinha colorida, nome, "X% • R$ Y").

**Implementação:** `react-native-svg` já instalado (`Svg`/`Circle` com `strokeDasharray`/`strokeDashoffset` por segmento — sem lib de chart nova, YAGNI). Cores dos segmentos NA ORDEM: `surfaceSuccess`, `contentWarning`, `accent`, `contentInfo` (todos tokens existentes — sem token novo). Props: `total: number; segments: RevenueSegment[]` (Task 1). Card externo: header "Receita por serviço" (accent) + "Últimos 30 dias" + botão redondo navy com ícone de tendência (decorativo).

**Steps 1-4 (TDD):** legenda renderiza um row por segmento no formato "45% • R$ 1.912"; label central mostra o total; 0 segmentos → mensagem vazia ("Sem receita nos últimos 30 dias"). SVG: assertar por testID dos segmentos (não pixel).

**Step 5: Commit** — `git commit -m "feat(dashboard): revenue by service donut"`

## Task 7: Redesign da home do lojista (dashboard-update)

**Files:**
- Modify: `app/(merchant)/home/index.tsx`
- Modify (se necessário): `lib/hooks/useMerchantMetrics.ts`
- Test: `__tests__/merchant-home-redesign.test.tsx`

**Step 0:** `get_design_context` nodeId `2478:111` + screenshot.

**Dados:** a tela hoje carrega business + agendamentos via Supabase — MANTER. Para métricas: reusar `lib/hooks/useMerchantMetrics.ts` (`appointments.total`, `revenue.total/byPeriod`, `reviews.average`, `referrals`) — **estender o hook** com (a) os mesmos totais do MÊS ANTERIOR (para `computeMonthOverview` e `computeDelta`), (b) receita por serviço dos últimos 30 dias (linhas `{serviceName, amount}` para `groupRevenueByService`) e (c) novos clientes do mês (count distinto de clientes com primeiro agendamento no mês — se a query ficar cara, computar a partir dos agendamentos já buscados). A matemática fica nos helpers puros (Task 1, já testados); o hook só busca e repassa. Teste do hook com supabase mockado SE o padrão já existir no repo; senão manter o hook fino e sem teste próprio.

**O que muda (de cima para baixo):**
1. `AppHeader` → **`TopBar`** (`variant="brand"`) com menu → **`AppDrawer`** (itens da decisão #7, lojista) e sino → notificações existentes.
2. Linha avatar (40px, `logo_url` real ou iniciais) + nome do negócio (bold 16).
3. **`GoalOverview`** alimentado por `computeMonthOverview` com receitas reais (mês atual vs anterior).
4. Linha de **`KpiCard`** (wrap 2×2): Agendamentos (total do mês + delta), Avaliação (`reviews.average` + delta absoluto), Indicações (referrals do mês + delta), Novos clientes (+ delta). Ícones: usar `Icon`/`lib/icons` existentes mais próximos (calendário, estrela, aperto de mão/pessoas, perfil) — SEM baixar assets do Figma.
5. "Próximos agendamentos": rows do Figma (header serviço+cliente; linha ícone + hora + chevron; borda inferior 1px) com os agendamentos reais de hoje/futuros (máx. 3) → tap abre o detalhe existente (`/(merchant)/dashboard/appointment/[id]`); ghost "Ver todos" → `/(merchant)/dashboard` (agenda). Empty state pt-BR simples quando não houver.
6. **`RevenueDonut`** com `groupRevenueByService` dos últimos 30 dias.
7. **Remover** as seções antigas "Meus Agendamentos"/"Meus Serviços"/botão "Compartilhar perfil" da tela (decisão #5 — acesso via drawer). **Sem FAB** (decisão #4, TODO(F6) no código).

**Steps 1-4 (TDD):** supabase + `useMerchantMetrics` mockados no módulo de teste. Testes: (a) GoalOverview com valores mockados; (b) KPIs renderizam e o badge some sem mês anterior; (c) próximos agendamentos listam e "Ver todos" navega para a agenda; (d) donut renderiza os segmentos; (e) menu abre o drawer.

**Step 5: Fidelidade** — screenshot vs Figma.

**Step 6: Commit** — `git commit -m "feat(merchant): redesigned dashboard home with goal, kpis and revenue donut"`

## Task 8: Verificação final da fase

**Step 1:** Suíte completa: `npx jest --maxWorkers=2` → PASS (baseline pré-F2: 251 testes / 29 suites — só pode crescer).
**Step 2:** `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` e `npm run lint` → 0 erros.
**Step 3:** QA em dispositivo: `npx expo start` — percorrer home cliente (busca, stories, destaque, serviços, drawer, sino) e home lojista (meta, KPIs, agendamentos, donut, drawer). ⚠️ Validar com DADOS REAIS de um usuário de teste (as telas são Supabase-backed) — inclusive os estados vazios (cliente sem agendamento, lojista sem receita no mês anterior).
**Step 4:** Fidelidade final: screenshot Figma vs app (`2715:3426`, `2478:111`).
**Step 5:** Atualizar `docs/plans/2026-07-06-novo-escopo-master.md` marcando a Fase 2 como implementada (mesmo formato da F0/F1, registrando QA pendente se for o caso).
**Step 6: Commit** — `git commit -m "docs: mark F2 done in new scope master plan"`
