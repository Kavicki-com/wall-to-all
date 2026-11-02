# F7 (Perfil do lojista + Assinatura) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evoluir o perfil do lojista para o profile-view `2611:6893` (selos `2625:5970` + fileira de KPIs) e criar a assinatura do lojista (subscription-offer `2678:150` e subscription-manage `2680:177`) sobre um `SubscriptionService` mock que a Task 17 da F8 troca por Stripe Billing sem tocar em tela.

**Architecture:** Dois domínios novos em arquivos próprios (`lib/services/subscriptionTypes.ts` e `lib/services/profileTypes.ts`), com mocks em `lib/services/mock/`, injetados no `ServicesProvider` como `subscription` e `stamps`. O serviço de assinatura é quem cobra (`subscribe(card)` devolve `active` ou `incomplete`), espelhando o Billing. Os KPIs saem da home do lojista para `lib/merchant/merchantKpis.ts` (teste de caracterização antes) e alimentam home e perfil. A assinatura é uma rota hub (`app/(merchant)/assinatura/index.tsx`) que escolhe Oferta ou Gerenciar pelo status, consumindo `CardSelectionBottomSheet` e `PaymentProcessingSheet` sem editá-los.

**Tech Stack:** Expo + expo-router · Supabase real (perfil, serviços, reviews, appointments) · mocks em memória (`MockSubscriptionService`, `MockProfileStampsService`, `MockWalletService`, `MockQiService`) · jest + @testing-library/react-native (`renderWithProviders`) · tokens de `lib/theme.ts` · `formatBRL` (centavos).

**Referências:** design doc `docs/plans/2026-11-02-f7-perfil-assinatura-design.md` · doc mestre `docs/plans/2026-07-06-novo-escopo-master.md` (§ Fase 7, § 4, § 5) · modelo: `docs/plans/2026-10-28-f5-agendamento-plan.md` · consumidor: Task 17 de `docs/plans/2026-11-02-f8-pagamentos-stripe-plan.md` (worktree da F8, só leitura).

**Branch/worktree:** `feat/f7-perfil-assinatura` em `.worktrees/f7-perfil-assinatura` (criado de `origin/main` = `4cca553` em 02/11, sem upstream; `npm ci` feito; baseline 69 suítes / 525 testes verdes). Nunca trabalhar no diretório principal nem em outro worktree.

---

## Convenções (idênticas às fases anteriores + regras de paralelismo)

- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`. Suíte autoritativa: `npx jest --maxWorkers=2`. Suíte completa só no fim de cada lote (Tasks 3, 6, 9) e na Task 10; no dia a dia rodar só os arquivos da task. Nunca dois builds ao mesmo tempo (três sessões neste Windows).
- Tokens de `lib/theme.ts`; token novo do Figma → só ADICIONAR ao theme, nunca mudar valor. Montserrat apenas. Copy e comentários pt-BR. **Sem travessão (em dash) em nenhum texto, código ou commit**: o placeholder de nota da home vira a constante `NO_RATING = '\u2014'` (mesmo glifo renderizado, sem o caractere na fonte). Commits SEM atribuição de AI (nem Co-Authored-By, nem rodapé). `git add` e `git commit` em comandos SEPARADOS. Nunca `git stash` sem tag.
- Step 0 de cada tela: carregar a skill `figma-design-to-code` (recurso `skill://figma/figma-design-to-code/SKILL.md`) uma vez por sessão; `get_design_context` só para o node da task (custa ~25k tokens); para conferir medidas, preferir `get_metadata` e `get_screenshot`. fileKey `c1QOl8EocqBiGd6R2NzrFn`. NUNCA usar URLs de asset do Figma no código: baixar para `assets/`.
- Valores em **centavos** (`formatBRL`). Datas da assinatura com `formatSubscriptionDate` (Task 2).
- Testes de tela: `renderWithProviders` de `__tests__/test-utils` (ganha `subscription` e `stamps` nas Tasks 1 e 2); `jest.mock('expo-router', ...)` no escopo do módulo; `jest.mock('../components/ui/ToastProvider', ...)` com `showSuccess`/`showError` como em `__tests__/merchant-home-redesign.test.tsx`; `NotificationContext`, `NotificationModal` e `react-native-safe-area-context` mockados como em `__tests__/merchant-financeiro.test.tsx`.
- **Território:** `app/(merchant)/profile/*`, `app/(merchant)/assinatura/*`, `components/subscription/*`, `lib/services/subscriptionTypes.ts`, `lib/services/mock/mockSubscriptionService.ts`, `lib/services/profileTypes.ts`, `lib/services/mock/mockProfileStampsService.ts`, `lib/subscription/*`, `lib/merchant/*`, `assets/stamps/*`, `components/profile/ProfileStampsRow.tsx` (novo), testes novos.
- **[zona compartilhada]** (só acrescentar, sem reformatar nem reordenar): `context/ServicesContext.tsx`, `__tests__/test-utils.tsx`, `components/layout/merchantDrawerItems.ts`, `app/(merchant)/_layout.tsx`, e `app/(merchant)/home/index.tsx` (só a troca do cálculo de KPIs, Task 3).
- **NÃO tocar:** `lib/services/types.ts`, `components/payment/*`, demais `components/profile/*`, `components/dashboard/KpiCard.tsx`, `components/home/HomeTopBar.tsx`, feed, schedule, wallet, financeiro, qi, aqui-agora, `app/_layout.tsx`, `supabase/*`.

---

## Decisões de produto registradas (não re-litigar; detalhe no design § 1)

1. Sem dependência da F6 (profile-view não tem feed).
2. **O `SubscriptionService` cobra**; a tela nunca chama `wallet.payWithCard` para assinar.
3. Status `active | past_due | canceled | incomplete` + `cancelAtPeriodEnd`; recusa em `subscribe` NÃO lança (devolve `incomplete`).
4. Sem Pix na assinatura (o Figma não oferece).
5. Plano e valor do mock: "Wall to All Premium", R$ 29,90/mês.
6. Rota hub única; Oferta para `null | canceled | incomplete`, Gerenciar para `active | past_due`.
7. Cancelar com confirmação; `resume()` desfaz ("Manter assinatura").
8. KPIs extraídos da home (`lib/merchant/merchantKpis.ts`); selos de mock fixo atrás de `ProfileStampsService`.
9. Perfil do lojista sem card de endereço.
10. Sem cartão salvo: CTA de assinar desabilitado + "Nenhum cartão salvo".

---

## Task 1: Domínio `SubscriptionService` (tipos + mock + wiring) [zona compartilhada]

**Files:**
- Create: `lib/services/subscriptionTypes.ts` · `lib/services/mock/mockSubscriptionService.ts`
- Modify (aditivo): `context/ServicesContext.tsx` (+ import, `subscription` no tipo, `subscriptionRef`, singleton default, `useSubscriptionService`) · `__tests__/test-utils.tsx` (+ import, `subscription?` em options e no tipo de retorno, criação default, `trackDisposable`, retorno)
- Test: `__tests__/mock-subscription-service.test.ts` · estender `__tests__/services-context.test.tsx` (hook novo lança fora do provider e resolve dentro)

**Step 1: Contrato** exatamente como no design § 3.1, com JSDoc pt-BR (por que o serviço cobra; mapeamento esperado na F8).

**Step 2: Testes que falham** (`now: () => new Date('2026-05-20T12:00:00.000Z')`, `latencyMs: 0`, cartões `visa = { id: 'card_visa_1', brand: 'visa', last4: '4242', holderName: 'X', expiry: '12/30', isDefault: true }` e `master` com `card_mastercard_1`/`5454`):
- `getPlan()` → `{ name: 'Wall to All Premium', badge: 'PLANO ÚNICO', priceCents: 2990, interval: 'month' }` e 6 `features` na ordem do Figma ("Agendamentos ilimitados", "Dashboard completo com métricas", "Sistema de indicações (Quem Indica)", "Carteira financeira e saques via PIX", "Cadastro ilimitado de serviços", "Suporte prioritário ao lojista").
- Default (`initial` omitido): `getSubscription()` → `null`; `getInvoices()` → `[]`.
- `subscribe(visa)` → `status 'active'`, `cancelAtPeriodEnd false`, `card { id: 'card_visa_1', brand: 'visa', last4: '4242' }`, `currentPeriodEnd` = `2026-06-20T12:00:00.000Z`; `getInvoices()` → 1 fatura `paid` de 2990.
- `declineCardIds: ['card_visa_1']`: `subscribe(visa)` → `status 'incomplete'` (não lança) e fatura `open`; em seguida `subscribe(master)` substitui → `active` com `5454`.
- `subscribe` com assinatura `active` → lança.
- `initial: 'active'` → `active`, `•••• 4242`, `currentPeriodEnd 2026-06-14T12:00:00.000Z`, 4 faturas `paid` em ordem decrescente (14/05, 14/04, 14/03, 14/02, todas 12:00Z).
- `initial: 'past_due'` → `past_due`, fatura mais recente `open`; `updatePaymentCard(master)` → `active`, cartão `5454`, fatura vira `paid`; com `declineCardIds: ['card_mastercard_1']` continua `past_due` e o cartão é trocado.
- `updatePaymentCard` em `active` só troca o cartão (faturas inalteradas).
- `cancel()` → `cancelAtPeriodEnd true`, status `active`; segunda chamada idempotente. `resume()` → `false`; idempotente. `initial: 'canceling'` → `active` + `cancelAtPeriodEnd true`.
- `cancel()`/`resume()`/`updatePaymentCard()` sem assinatura → lançam.
- Cópias defensivas: mutar o retorno de `getSubscription`/`getInvoices` não altera o estado.

**Step 3:** `npx jest mock-subscription-service services-context --maxWorkers=2` → FAIL (módulo inexistente).

**Step 4: Implementar.** `MockSubscriptionService({ latencyMs?, initial?, declineCardIds?, now? })`, `SIMULATED_LATENCY_MS = 300`, `delay()` igual ao `MockBookingPaymentService`. Datas sempre 12:00Z (evita virar o dia no fuso do Brasil). Semente: última fatura = dia 14 do mês corrente de `now()` se `now` >= dia 14, senão do mês anterior; as outras 3 recuam 1 mês cada; `currentPeriodEnd` = última + 1 mês. Helper `addMonths` local (UTC). Wiring copiando o padrão do `booking` linha a linha, sem reordenar.

**Step 5:** verde + typecheck. Commit:
```bash
git add lib/services/subscriptionTypes.ts lib/services/mock/mockSubscriptionService.ts context/ServicesContext.tsx __tests__/test-utils.tsx __tests__/mock-subscription-service.test.ts __tests__/services-context.test.tsx
```
```bash
git commit -m "feat(subscription): subscription service contract with in-memory mock"
```

## Task 2: Selos (`ProfileStampsService`) + formatador de data [zona compartilhada]

**Files:**
- Create: `lib/services/profileTypes.ts` · `lib/services/mock/mockProfileStampsService.ts` · `lib/subscription/formatDate.ts`
- Modify (aditivo): `context/ServicesContext.tsx` (`stamps` + `useProfileStampsService`) · `__tests__/test-utils.tsx` (`stamps`)
- Test: `__tests__/mock-profile-stamps-service.test.ts` · `__tests__/subscription-format-date.test.ts` · estender `__tests__/services-context.test.tsx`

**Step 1: Testes que falham:**
- Stamps: default → `[{ id: 'five_stars', label: '5 estrelas', earned: true }, { id: 'full_schedule', label: 'Agenda cheia', earned: true }]` nessa ordem; `{ earned: ['five_stars'] }` → `full_schedule` com `earned false`; cópia defensiva.
- `formatSubscriptionDate('2026-06-14T12:00:00.000Z')` → `'14 jun 2026'`; `'2026-05-04T12:00:00.000Z'` → `'4 mai 2026'`; todos os 12 meses (`jan fev mar abr mai jun jul ago set out nov dez`); ISO inválido → lança.
- `useProfileStampsService` fora do provider lança.

**Step 2:** FAIL. **Step 3:** implementar (`formatSubscriptionDate` com `parseISO` do date-fns + array próprio de meses, sem depender do locale do dispositivo; `isValid` falso → `throw new Error`). **Step 4:** verde + typecheck. Commit:
```bash
git add lib/services/profileTypes.ts lib/services/mock/mockProfileStampsService.ts lib/subscription/formatDate.ts context/ServicesContext.tsx __tests__/test-utils.tsx __tests__/mock-profile-stamps-service.test.ts __tests__/subscription-format-date.test.ts __tests__/services-context.test.tsx
```
```bash
git commit -m "feat(profile): profile stamps service mock and subscription date formatter"
```

## Task 3: KPIs extraídos para `lib/merchant/merchantKpis.ts` (caracterização, sem mudança visual) [zona compartilhada: home]

**Files:**
- Create: `lib/merchant/merchantKpis.ts`
- Modify: `app/(merchant)/home/index.tsx` (substitui o cálculo inline dos KPIs pelas funções do módulo; meta, donut e próximos agendamentos intactos)
- Test: `__tests__/merchant-kpis.test.ts` · regressão: `__tests__/merchant-home-redesign.test.tsx` SEM alteração

**API do módulo** (mover de `home/index.tsx`, não reescrever: `REVENUE_STATUSES`, `Delta`, `MaybeJoined`, `MetricsRow`, `ReviewRow`, `firstOf`, `pctDelta`, `absDelta`):
```ts
export type KpiValue = { value: string; delta: Delta };
export interface MerchantKpis { agendamentos: KpiValue; avaliacao: KpiValue; indicacoes: KpiValue; novosClientes: KpiValue }
export const NO_RATING = '\u2014';
export const EMPTY_MERCHANT_KPIS: MerchantKpis;      // valores iniciais da home
export function monthWindows(now: Date): { startOfCurrentMonth: Date; startOfPreviousMonth: Date; endOfCurrentMonth: Date };
export function monthClientIds(rows: MetricsRow[], now: Date): { current: string[]; previous: string[] };
export async function fetchPriorClientIds(businessId: number, clientIds: string[], before: Date): Promise<Set<string>>;
export function computeMerchantKpis(input: {
  rows: MetricsRow[]; reviewRows: ReviewRow[]; indicadosCount: number; now: Date;
  priorCurrent: Set<string>; priorPrevious: Set<string>;
}): MerchantKpis;
/** Para telas que não buscam as linhas por conta própria (perfil): faz as consultas da home e calcula. */
export async function loadMerchantKpis(businessId: number, qi: QiService, now?: Date): Promise<MerchantKpis>;
```

**Step 1: Testes que falham** (`now = new Date(2026, 4, 20, 12)`; puro, exceto o último bloco):
- `computeMerchantKpis` com 3 `confirmed`/`completed` no mês corrente e 2 no anterior → `agendamentos { value: '3', delta: { text: '+50%', up: true } }`.
- `pending`/`canceled` ignorados na contagem e nos clientes.
- Reviews `[5, 4, null]` → `avaliacao { value: '4.5', delta: null }`; sem reviews → `value NO_RATING`.
- `indicadosCount 8` → `indicacoes { value: '8', delta: null }`.
- Clientes do mês `a, b, c` com `priorCurrent {a}` e do mês anterior `d, e` com `priorPrevious {}` → `novosClientes { value: '2', delta: ... }` (fixar a expectativa exata a partir de `computeDelta(2, 2)` de `lib/dashboardMetrics` antes de escrever o teste).
- Join do serviço como array de 1 aceito (`firstOf`).
- Mês sem linhas → `agendamentos '0'`, delta conforme `computeDelta(0, 0)`.
- `monthClientIds` separa por mês e deduplica.
- `loadMerchantKpis` (mock de `lib/supabase` no padrão de `merchant-home-redesign.test.tsx`): consulta `appointments` e `reviews` com `business_id`, chama `qi.getQiSummary('merchant')` e devolve o mesmo resultado de `computeMerchantKpis` para as mesmas linhas.

**Step 2:** FAIL. **Step 3:** mover o código; na home, `setKpis(computeMerchantKpis({...}))` usando as linhas já buscadas, `monthClientIds` + `fetchPriorClientIds` no lugar da closure local; estado inicial `EMPTY_MERCHANT_KPIS`. **Step 4:** `npx jest merchant-kpis merchant-home-redesign --maxWorkers=2` verde SEM editar o teste da home + typecheck. **Fim do lote 1:** suíte completa (`npx jest --maxWorkers=2`) e relatório.

Commit:
```bash
git add lib/merchant/merchantKpis.ts "app/(merchant)/home/index.tsx" __tests__/merchant-kpis.test.ts
```
```bash
git commit -m "refactor(merchant): extract kpi computation from merchant home"
```

## Task 4: `ProfileStampsRow` + assets dos selos

**Files:**
- Create: `components/profile/ProfileStampsRow.tsx` · `assets/stamps/five-stars-active.png` · `assets/stamps/five-stars-disabled.png` · `assets/stamps/full-schedule-active.png` · `assets/stamps/full-schedule-disabled.png`
- Test: `__tests__/profile-stamps-row.test.tsx`

**Step 0:** `get_design_context` `2625:5970`; baixar os 4 símbolos (`2625:5966`, `2625:5969`, `2625:5967`, `2625:5968`) em PNG @3x (192 x 192) para `assets/stamps/` com curl a partir das URLs devolvidas (URLs nunca vão para o código). Conferir com `get_screenshot`.

**Step 1: Testes que falham:** 2 selos renderizados na ordem recebida; `accessibilityLabel` `'Selo 5 estrelas, conquistado'` / `'Selo Agenda cheia, não conquistado'`; `testID` `stamp-five_stars-active` vs `stamp-full_schedule-disabled` conforme `earned`; lista vazia → não renderiza nada (`toJSON()` null).

**Step 2:** FAIL. **Step 3:** implementar (`Image` 64 x 64, `flexDirection: 'row'`, gap 8, mapa `id x earned → require(...)`). **Step 4:** verde. Commit:
```bash
git add components/profile/ProfileStampsRow.tsx assets/stamps __tests__/profile-stamps-row.test.tsx
```
```bash
git commit -m "feat(profile): profile stamps row with figma badge assets"
```

## Task 5: Perfil do lojista: selos, KPIs e sem endereço

**Files:**
- Modify: `app/(merchant)/profile/index.tsx`
- Test: `__tests__/merchant-profile-view.test.tsx` · regressão: `__tests__/ratings-row-card.test.tsx`, `__tests__/client-home-redesign.test.tsx`

**Step 0:** `get_design_context` `2611:6893` só se screenshot + metadata não bastarem para os espaçamentos entre hero, selos (y 138), ratings (y 210), kpi-row (y 266, cards 124 x 111, gap 8) e pagamentos (y 385).

**Step 1: Testes que falham** (`jest.mock('../context/BusinessProfileContext')` com perfil fixo incluindo `address`; `jest.mock('../lib/merchant/merchantKpis')` com `loadMerchantKpis` resolvendo `{ agendamentos: { value: '24', delta: { text: '+12%', up: true } }, avaliacao: { value: '4.8', delta: null }, indicacoes: { value: '8', delta: null }, novosClientes: { value: '25', delta: { text: '+12', up: true } } }`; mock de `lib/supabase` para `services` e `reviews`):
- Mostra os 2 selos (`stamp-five_stars-active`, `stamp-full_schedule-active`).
- Mostra os 4 KPIs com rótulos "Agendamentos", "Avaliação", "Indicações", "Novos clientes" e valores 24, 4.8, 8, 25; `loadMerchantKpis` chamado com o `id` do negócio.
- NÃO mostra o endereço do perfil.
- `loadMerchantKpis` rejeitando → a tela renderiza (serviços e "Editar Perfil" visíveis) com KPIs default.
- `stamps.getStamps` rejeitando → sem selos, resto da tela visível.
- Mantidos: "Editar Perfil" → `push('/(merchant)/profile/edit')`; "Cadastrar novo serviço" → `push('/(merchant)/services/create')`.

**Step 2:** FAIL. **Step 3:** implementar: `ProfileStampsRow` entre `ProfileHero` e `RatingsRowCard`; `ScrollView horizontal` com 4 `KpiCard` (`style={{ width: 124 }}`, ícones do `Icon`/`MaterialSymbolIcon` equivalentes a `date-range`, estrela, `handshake`, `account-circle`; conferir os nomes disponíveis antes); remover `ProfileAddressCard` e o import. Carga paralela: dados atuais + `loadMerchantKpis(businessProfile.id, qi)` + `stamps.getStamps()` com `Promise.allSettled`.
**Step 4:** verde + regressões + typecheck + comparação visual. Commit:
```bash
git add "app/(merchant)/profile/index.tsx" __tests__/merchant-profile-view.test.tsx
```
```bash
git commit -m "feat(profile): merchant profile with stamps and kpi row"
```

## Task 6: Blocos da assinatura (`components/subscription/*`)

**Files:**
- Create: `components/subscription/SubscriptionStatusCard.tsx` · `components/subscription/SubscriptionPaymentRow.tsx` · `components/subscription/SubscriptionInvoiceList.tsx`
- Test: `__tests__/subscription-blocks.test.tsx`

**Step 0:** `get_design_context` `2680:177` (card de status, linha do cartão, histórico).

**Step 1: Testes que falham:**
- `SubscriptionStatusCard({ subscription, plan })`: `active` → "ATIVO", "Wall to All Premium", "R$ 29,90 · cobrado mensalmente", "Próxima cobrança em 14 jun 2026"; `past_due` → "PAGAMENTO PENDENTE" + "Atualize a forma de pagamento para manter o acesso."; `cancelAtPeriodEnd` → "CANCELAMENTO AGENDADO" + "Acesso até 14 jun 2026".
- `SubscriptionPaymentRow({ card, onChange })`: "Pagamento com Cartão", "•••• 4242", bandeira (`CardBrandFlag`), "Alterar" chama `onChange`; `card null` → "Nenhum cartão" e "Alterar" ainda chama `onChange`.
- `SubscriptionInvoiceList({ invoices })`: mostra 4 de 6 faturas ("14 mai 2026", "R$ 29,90", "Pago"); `open` → "Pendente"; "Ver todas as faturas" expande para 6 e some; com <= 4 faturas o link não aparece; lista vazia → "Nenhuma cobrança ainda".

**Step 2:** FAIL. **Step 3:** implementar com tokens (card navy `colors.brand`, com gradiente só se já houver padrão no app; badge verde `surfaceSuccess`, vermelho `accent`; títulos de seção `accent` bold 18 como no Figma). **Step 4:** verde. **Fim do lote 2:** suíte completa e relatório.

Commit:
```bash
git add components/subscription __tests__/subscription-blocks.test.tsx
```
```bash
git commit -m "feat(subscription): status card, payment row and invoice list"
```

## Task 7: Visões Oferta e Gerenciar

**Files:**
- Create: `components/subscription/SubscriptionOfferView.tsx` · `components/subscription/SubscriptionManageView.tsx` · `components/subscription/CancelSubscriptionModal.tsx`
- Test: `__tests__/subscription-views.test.tsx`

**Step 0:** `get_design_context` `2678:150`.

**Step 1: Testes que falham:**
- Oferta: badge "PLANO ÚNICO", "Wall to All Premium", descrição, "29,90" e "/mês", título "O que está incluso" + 6 itens, "Cancele quando quiser" + "Sem fidelidade, você assina por mês e cancela direto pelo app." (o Figma usa travessão nessa frase; trocar por vírgula), CTA "Assinar por R$ 29,90/mês" chama `onSubscribe`; `subscribeDisabled` → CTA desabilitado e aviso "Nenhum cartão salvo" (`noCardHint`); "Termos do plano e política de cobrança" chama `onOpenTerms`.
- Gerenciar: compõe os 3 blocos; "Cancelar assinatura" abre o modal; no modal, "Cancelar assinatura" confirma (`onCancel`) e "Voltar" fecha sem chamar; texto "Você mantém o acesso até 14 jun 2026."; com `cancelAtPeriodEnd` o botão vira "Manter assinatura" e chama `onResume`; `busy` desabilita os botões.

**Step 2:** FAIL. **Step 3:** implementar (props das visões no design § 5.2 e § 5.3; modal com `Modal` do RN, no padrão de `components/ui/RescheduleModalCard.tsx`). **Step 4:** verde. Commit:
```bash
git add components/subscription __tests__/subscription-views.test.tsx
```
```bash
git commit -m "feat(subscription): offer and manage views with cancel confirmation"
```

## Task 8: Rota hub `app/(merchant)/assinatura/index.tsx`

**Files:**
- Create: `app/(merchant)/assinatura/index.tsx`
- Test: `__tests__/merchant-subscription-screen.test.tsx`

**Step 1: Testes que falham** (`renderWithProviders` com `subscription: new MockSubscriptionService({ latencyMs: 0, initial, declineCardIds, now })` e o `MockWalletService` default; `useFocusEffect` mockado para rodar uma vez, como em `merchant-financeiro.test.tsx`; a duração mínima real de 600 ms é aguardada com `findBy*`, como em `schedule-confirm.test.tsx`):
- Título "Minha assinatura" e `HomeTopBar` (menu abre o drawer com "Assinatura").
- `initial 'none'` → Oferta. "Assinar" abre "Meus cartões"; "Selecionar cartão" → "Processando seu pagamento..." → `showSuccess('Assinatura ativada')` → Gerenciar com "ATIVO" e "•••• 4242".
- `declineCardIds ['card_visa_1']` → `showError('Pagamento recusado. Tente outro cartão.')` e continua na Oferta.
- Wallet sem cartões (`getCards` → `[]` via `jest.spyOn`) → CTA desabilitado + "Nenhum cartão salvo".
- `initial 'active'` → Gerenciar; "Alterar" → sheet → escolher o Mastercard (tocar no cartão de trás e confirmar) → linha mostra "•••• 5454".
- `initial 'past_due'` → "PAGAMENTO PENDENTE"; trocar cartão → processando → "ATIVO".
- Cancelar → confirmar → "CANCELAMENTO AGENDADO" e botão "Manter assinatura" → tocar → "ATIVO".
- `getSubscription` rejeitando → `showError` + botão "Tentar novamente" que recarrega.
- "Termos do plano e política de cobrança" → `push('/(merchant)/settings/terms')`.

**Step 2:** FAIL. **Step 3:** implementar: casca como `app/(merchant)/financeiro/index.tsx` (`HomeTopBar`, `AppDrawer` com `MERCHANT_DRAWER_ITEMS`, `NotificationModal`), título "Minha assinatura" no corpo (divergência #11); `load()` com `Promise.all([getPlan, getSubscription, getInvoices, wallet.getCards])`; visão por status; `PROCESSING_MIN_MS = 600` e `delay` locais (mesmo valor da F5); `busy` bloqueia toques duplos. **Step 4:** verde + typecheck + comparação visual. Commit:
```bash
git add "app/(merchant)/assinatura/index.tsx" __tests__/merchant-subscription-screen.test.tsx
```
```bash
git commit -m "feat(subscription): merchant subscription hub screen"
```

## Task 9: Entrada no app (drawer + rota oculta) [zona compartilhada]

**Files:**
- Modify (aditivo): `components/layout/merchantDrawerItems.ts` (+ `{ label: 'Assinatura', route: '/(merchant)/assinatura' }` logo após "Perfil" em `ITEMS_AFTER_QI`) · `app/(merchant)/_layout.tsx` (+ `Tabs.Screen name="assinatura/index"` com `tabBarButton: () => null`, após o bloco do QI, com comentário "Assinatura do lojista F7")
- Test: `__tests__/merchant-drawer-items.test.ts`

**Step 1: Testes que falham:** `MERCHANT_DRAWER_ITEMS` contém "Assinatura" logo depois de "Perfil" com rota `/(merchant)/assinatura`; `MERCHANT_HOME_DRAWER_ITEMS` idem, com "Compartilhar perfil" preservado; nenhum rótulo duplicado.

**Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde + typecheck + `npx jest merchant-financeiro merchant-qi merchant-aqui-agora merchant-home-redesign --maxWorkers=2` (telas que usam o drawer). **Fim do lote 3:** suíte completa e relatório.

Commit:
```bash
git add components/layout/merchantDrawerItems.ts "app/(merchant)/_layout.tsx" __tests__/merchant-drawer-items.test.ts
```
```bash
git commit -m "feat(subscription): subscription entry in merchant drawer"
```

## Task 10: Verificação final, rebase e PR

1. `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` → 0 erros. `npm run lint` → nenhum problema novo. `npx jest --maxWorkers=2` → todas verdes (baseline 525 só cresce). `git diff origin/main --name-only | xargs grep -nP "\x{2014}"` → nenhum hit em linha adicionada pela F7.
2. Fidelidade final vs `2611:6893`, `2625:5970`, `2678:150`, `2680:177`, contra a tabela de 11 divergências do design § 6.
3. QA manual sugerido (registrar no PR como pendente em dispositivo): perfil (selos, KPIs rolando, sem endereço) · drawer → Assinatura → assinar → gerenciar → alterar cartão → cancelar → manter.
4. **Rebase:** `git fetch origin` e `git rebase origin/main`. Conflitos esperados em `context/ServicesContext.tsx`, `__tests__/test-utils.tsx`, `app/(merchant)/_layout.tsx`, `components/layout/merchantDrawerItems.ts` e talvez `app/(merchant)/home/index.tsx`: manter as adições de TODAS as fases. Se a F8 tiver mudado as props de `CardSelectionBottomSheet`/`PaymentProcessingSheet`, ajustar só as chamadas. Rodar typecheck e suíte de novo.
5. `git push -u origin feat/f7-perfil-assinatura`. PR pela REST API do GitHub (o `gh` não está instalado): token de `git credential fill` (nunca imprimir), corpo JSON montado em UTF-8 com node, sem rodapé de AI. Corpo: resumo, decisões, tabela de divergências, dívidas F8, zonas compartilhadas tocadas, contrato para a Task 17 da F8 (incluindo `resume()`).
6. **Depois do merge:** atualizar o doc mestre (§ Fase 7 ✅ + linha na § 7) num PR separado.

**Commits:** um por task (mensagens acima); `docs: f7 profile and subscription design and plan` no início da branch.
