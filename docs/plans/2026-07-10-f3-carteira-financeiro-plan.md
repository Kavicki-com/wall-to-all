# F3 (Carteira cliente + Financeiro lojista) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar a Carteira do cliente (cartões + chaves Pix + extrato; Figma `2715:3681` 🆕) e o Financeiro do lojista (saldo + saque + chaves Pix + extrato + gráficos; Figma `2597:5956`/`2602:5991`), UI-first sobre o `WalletService` mockado.

**Architecture:** Volta ao modelo da F1 (mock-first): **toda a F3 vive no domínio mockado da carteira** — `WalletService` é estendido com chaves Pix, cadastro de cartão, extrato e o lado lojista (saldo/saque), seguindo o padrão do `QueueService` (seções `// cliente` e `// lojista` numa mesma interface, mock em memória, injeção via `ServicesProvider`). Telas novas como rotas ocultas dos `Tabs`, acesso pelos drawers. Componentes de pagamento da F0 (`CardsStack`, `CreditCard`) e o `RevenueDonut` da F2 são REUSADOS.

**Tech Stack:** Expo + expo-router · `MockWalletService` (Supabase só na F8) · react-native-svg (gráfico de linha novo) · jest + @testing-library/react-native (`renderWithProviders`) · tokens de `lib/theme.ts`.

**Referência de escopo:** `docs/plans/2026-07-06-novo-escopo-master.md` (§ Fase 3; nota da linha ~110: o withdraw 🆕 `2715:3711` é a referência visual mais recente de saque — comparar com `2602:6092` e seguir o 🆕 onde coincidir).

**Branch:** criar `feat/f3-carteira-financeiro` a partir de `main` (F0/F1/F2 já mergeadas).

**Convenções (idênticas às fases anteriores):**
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`. Suíte autoritativa: `npx jest --maxWorkers=2` (o `npm test` tem flake fantasma de teardown no Windows). Baseline pré-F3: 300 testes / 37 suites.
- Tokens de `lib/theme.ts`; token novo do Figma → adicionar ao theme, nunca hex inline. Montserrat apenas. Copy/comentários pt-BR. Commits sem atribuição de AI. `git add`/`git commit` em comandos SEPARADOS, sem pipe.
- Step 0 de cada tela: `mcp__claude_ai_Figma__get_design_context` com o nodeId indicado (fileKey `c1QOl8EocqBiGd6R2NzrFn`); screenshot = referência de fidelidade. NUNCA usar URLs de asset do Figma no código.
- Valores monetários do domínio da carteira em **centavos** (`formatBRL` de `lib/formatters` para exibir; `formatReais` para valores inteiros sem centavos nos gráficos).
- Testes de tela: `renderWithProviders` de `__tests__/test-utils` com `MockWalletService({ latencyMs: 0 })` injetado via `{ wallet }`; mocks módulo-escopo de `expo-router` e `react-native-safe-area-context` (padrão dos testes F1).

---

## Decisões de produto registradas (não re-litigar)

1. **F3 é 100% domínio mock da carteira** (como a F1). O Financeiro do lojista (saldo, extrato, faturamento, donut) é alimentado APENAS pelo mock — NÃO mistura com as queries Supabase do dashboard (F2). A unificação acontece na F8. Documentar nos arquivos.
2. **`WalletService` estendido no padrão `QueueService`**: uma interface com seções `// cliente` e `// lojista`. Tipos novos: `PixKey`, `WalletEntry` (extrato), métodos de cartão/chave/extrato/saldo/saque (contrato exato na Task 1).
3. **Chaves Pix**: tipos `cpf | cnpj | email | phone | random`. O mock armazena o valor JÁ MASCARADO (`maskPixValue` — privacidade por construção; ex.: CPF `123.456.789-12` → `*********-12`). Validação por tipo no formulário (Task 6). Fixtures: 1 chave CPF (`maskedValue: '*********-12'`) — o Figma mostra a mesma chave no cliente e no lojista.
4. **Cadastro de cartão (mock)**: validação leve — número 16 dígitos (máscara `0000 0000 0000 0000`), nome não vazio, validade `MM/AA` futura, CVV 3-4 dígitos. SEM Luhn e SEM tokenização (YAGNI até o PSP na F8). A bandeira é derivada do prefixo (4→visa, 5→mastercard, 3→amex, senão elo).
5. **Saque (lojista)**: exige ≥1 chave Pix cadastrada e `0 < valor ≤ saldo`. Sucesso: desconta o saldo, adiciona entrada NEGATIVA no extrato (`kind: 'withdraw'`), mostra loading e o modal de sucesso. Fluxo: financeiro → withdraw → loading → modal → volta ao financeiro atualizado.
6. **Reuso obrigatório**: `CardsStack`/`CreditCard` (F0) na seção "Meus cartões"; **`RevenueDonut` (F2) como está** no "Receita por serviço" do financeiro (alimentado por `groupRevenueByService` sobre o extrato mock); `getInitials`/`formatBRL`/`formatReais` de `lib/formatters`. O `MetricsChart` existente é de BARRAS — o "Faturamento" do Figma é linha/área → componente novo `EarningsLineChart` (Task 7).
7. **Rotas + navegação**: cliente `app/(client)/wallet/{index,new-card,new-pix-key}.tsx`; lojista `app/(merchant)/financeiro/{index,withdraw,new-pix-key}.tsx`. Todas ROTAS OCULTAS nos `_layout.tsx` (padrão "ROTAS OCULTAS" da F1). Acesso: item "Carteira" no drawer do cliente (home) e "Financeiro" no drawer do lojista (home + aqui-agora).
8. **Formulário de chave Pix compartilhado**: um componente `PixKeyForm` usado pelas duas telas (cliente `2660:6529`, lojista `2597:6009` — mesmo layout).
9. **Extrato do cliente começa vazio** ("Nenhum lançamento encontrado", como o Figma 🆕); o mock ganha fixtures de extrato apenas do LOJISTA (espelhando `2602:5991`: serviços + fura-fila). O extrato do cliente popula quando houver integração de pagamentos (F8).

---

## Task 1: Domínio — tipos + MockWalletService estendido

**Files:**
- Modify: `lib/services/types.ts` (após o bloco `WalletService` atual; mudança ADITIVA)
- Modify: `lib/services/mock/mockWalletService.ts`
- Test: `__tests__/mock-wallet-service.test.ts` (estender o existente)

**Step 1: Tipos novos + interface**:

```ts
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface PixKey {
  id: string;
  type: PixKeyType;
  /** Valor JÁ MASCARADO para exibição (privacidade por construção). */
  maskedValue: string;
  /** ISO 8601 */
  createdAt: string;
}

export type WalletEntryKind = 'service' | 'fura_fila' | 'withdraw';

export interface WalletEntry {
  id: string;
  kind: WalletEntryKind;
  /** Ex.: "Corte de cabelo masc." | "Furou Fila" | "Saque" */
  title: string;
  /** Ex.: nome do cliente | "Taxa de antecipação Fura Fila" | chave de destino */
  subtitle: string;
  /** Centavos; positivo = crédito, negativo = débito (saque). */
  amountCents: number;
  /** ISO 8601 */
  date: string;
}
```

E estender `WalletService` (final da interface, com comentários de seção):

```ts
  // cliente (F3)
  addCard(input: { number: string; holderName: string; expiry: string; cvv: string }): Promise<PaymentCard>;
  getPixKeys(): Promise<PixKey[]>;
  addPixKey(input: { type: PixKeyType; value: string }): Promise<PixKey>;
  getStatement(): Promise<WalletEntry[]>;
  // lojista (F3)
  getMerchantBalanceCents(): Promise<number>;
  getMerchantStatement(): Promise<WalletEntry[]>;
  requestWithdraw(amountCents: number, pixKeyId: string): Promise<void>;
```

**Step 2: Testes que falham** (adicionar ao `__tests__/mock-wallet-service.test.ts`): `addCard` deriva a bandeira pelo prefixo e adiciona à lista (`getCards` cresce; novo cartão NÃO vira default); `addPixKey` mascara por tipo (fixar o formato exato de máscara na implementação e assertar) e `getPixKeys` retorna a fixture CPF + a nova; `getStatement` (cliente) vazio; `getMerchantStatement` tem as fixtures (4 entradas, uma `fura_fila`); `getMerchantBalanceCents` = 59120; `requestWithdraw` feliz (desconta saldo, adiciona entrada negativa `withdraw` no extrato do lojista) e erros (valor > saldo → rejeita; `pixKeyId` desconhecido → rejeita; valor ≤ 0 → rejeita).

**Step 3: Rodar e ver falhar.** `npx jest mock-wallet-service --maxWorkers=2` → FAIL.

**Step 4: Implementar no `MockWalletService`:** helper puro `maskPixValue(type, value)` (exportado, testável direto); fixtures — 1 chave Pix CPF (`*********-12`), saldo lojista inicial `59120`, extrato lojista espelhando o Figma `2602:5991` (Furou Fila +800 "Taxa de antecipação Fura Fila" · Corte de cabelo masc. +6500 "Carlos Silva" · Barba e cabelo comp. +9500 "Anderson Ribeiro" · Tratamento folicular p. +12050 "Silvio Santos"; datas ISO fixas); `addCard` deriva `brand` do prefixo e guarda `last4`; cópias defensivas em todos os getters (padrão do arquivo).

**Step 5: Verde + typecheck + commit** — `feat(wallet): extend wallet domain with pix keys, statement and merchant balance`

## Task 2: `PixKeySection` (compartilhado cliente/lojista)

**Files:**
- Create: `components/wallet/PixKeySection.tsx`
- Test: `__tests__/pix-key-section.test.tsx`

**Step 0:** nodes `2715:3696..3704` (seção na Wallet). Card da chave: fundo `surface`, borda 2px `brand`, radius 16 — tipo em bold 16 (`textPrimary`, label pt-BR: CPF/CNPJ/E-mail/Telefone/Aleatória) sobre o `maskedValue` (12, `textSecondary`). Botão outline "+  Adicionar chave Pix" (borda `brand`, radius 24, 44px).

**Props:** `{ keys: PixKey[]; onAddPress: () => void; testID? }`. Sem título de seção (a tela põe o header "Chaves Pix"). Lista vazia → só o botão. Botão `accessibilityRole="button"`, `testID="btn-add-pix"`.

**Steps 1-4 (TDD):** renderiza um card por chave (label do tipo + maskedValue); vazio → sem cards, botão presente; `onAddPress` dispara.

**Step 5: Commit** — `feat(wallet): shared pix key section`

## Task 3: `StatementTimeline` (extrato compartilhado)

**Files:**
- Create: `components/wallet/StatementTimeline.tsx`
- Test: `__tests__/statement-timeline.test.tsx`

**Step 0:** nodes `2602:6327..6371` (timeline no financeiro). Cada linha: coluna do dot (20px redondo: `service` → fundo `surfaceSuccess` com "$"; `fura_fila` → `surfaceWarningLight` com "★" `contentWarning`; `withdraw` → `surfaceGrey` com "↓" `textSecondary`) + conector vertical 2px `surfaceGrey` (exceto na última) | conteúdo: título (bold 16 `textPrimary`) + valor à direita (`+R$ 65,00` em `surfaceSuccess` quando positivo; `-R$ ...` em `accent` quando negativo — `formatBRL(Math.abs(cents))` com sinal manual) | subtítulo (12 `textSecondary`) | data (12 Medium `textSecondary`, `dd/MM/yyyy` via date-fns, já dependência).

**Props:** `{ entries: WalletEntry[]; emptyMessage: string; testID? }`. `entries` vazio → só a `emptyMessage` (16, `textPrimary`).

**Steps 1-4 (TDD):** linha por entrada com título/subtítulo; valor positivo com "+" e negativo com "-"; empty message quando vazio; dot de `fura_fila` difere do de `service` (testID por kind, ex. `dot-fura_fila`).

**Step 5: Commit** — `feat(wallet): statement timeline component`

## Task 4: Wallet do cliente (`app/(client)/wallet/index.tsx`)

**Files:**
- Create: `app/(client)/wallet/index.tsx`
- Modify: `app/(client)/_layout.tsx` (ROTAS OCULTAS: `wallet/index`, `wallet/new-card`, `wallet/new-pix-key` — registrar as 3 já nesta task)
- Modify: `app/(client)/home/index.tsx` (drawer: item `Carteira` → `/(client)/wallet`)
- Test: `__tests__/client-wallet.test.tsx`

**Step 0:** `get_design_context` nodeId `2715:3681` (🆕). Estrutura: `HomeTopBar` (menu → AppDrawer do cliente — MESMOS itens da home + Carteira; sem sino, o Figma só mostra o menu) · "Meus cartões" (`accent` bold 16) + **`CardsStack`** (F0 — ler `components/payment/CardsStack.tsx` para o contrato; alimentar com `getCards()`) + botão outline "+  Adicionar cartão" → `router.push('/(client)/wallet/new-card')` · "Chaves Pix" + `PixKeySection` (`getPixKeys()`; add → `/(client)/wallet/new-pix-key`) · "Extrato" + `StatementTimeline` (`getStatement()`, emptyMessage "Nenhum lançamento encontrado").

**Dados:** `useWalletService()` do `ServicesContext`; carga com guarda `active` + gate de loading (`ActivityIndicator`) no padrão F1. **Recarregar ao voltar do cadastro**: `useFocusEffect` (expo-router) refaz o fetch no foco — é assim que o cartão/chave novos aparecem ao voltar.

**Steps 1-4 (TDD):** com o mock default — os 2 cartões renderizam (CardsStack), a chave CPF da fixture aparece (`*********-12`), extrato vazio → "Nenhum lançamento encontrado"; botões navegam (`mockPush` com as rotas); menu abre o drawer com o item "Carteira".

**Step 5: Fidelidade + commit** — `feat(client): wallet screen with cards, pix keys and statement`

## Task 5: Cadastro de cartão (`app/(client)/wallet/new-card.tsx`)

**Files:**
- Create: `app/(client)/wallet/new-card.tsx`
- Test: `__tests__/client-new-card.test.tsx`

**Step 0:** `get_design_context` nodeId `2660:6604`. Layout esperado: back "Voltar" (padrão settings da F1), preview do `CreditCard` (F0) refletindo o que é digitado, campos (número com máscara `0000 0000 0000 0000`, nome, validade `MM/AA`, CVV) e CTA "Salvar cartão" (navy, radius 24).

**Comportamento:** validação da decisão #4 (mensagens pt-BR inline por campo — ver os formulários de signup para o estilo de erro); máscaras via formatação manual no `onChangeText` (sem lib nova); CTA desabilitado enquanto inválido/salvando; sucesso → `addCard(...)` → `showSuccess('Cartão adicionado')` (ToastProvider) → `router.back()`.

**Steps 1-4 (TDD):** número inválido (<16 dígitos) → CTA desabilitado; validade passada → erro inline; preenchimento válido → `addCard` chamado com os dados normalizados e `mockBack` disparado; o teste envolve a tela em `ToastProvider` (padrão da F1 settings) e asserta o toast.

**Step 5: Fidelidade + commit** — `feat(client): new card registration screen`

## Task 6: `PixKeyForm` + telas de nova chave (cliente e lojista)

**Files:**
- Create: `components/wallet/PixKeyForm.tsx`
- Create: `app/(client)/wallet/new-pix-key.tsx` (thin wrapper)
- Create: `app/(merchant)/financeiro/new-pix-key.tsx` (thin wrapper; a rota do lojista é registrada na Task 8)
- Test: `__tests__/pix-key-form.test.tsx`

**Step 0:** nodes `2660:6529` (cliente) e `2597:6009` (lojista) — mesmo layout: seletor do TIPO da chave (seguir o Figma; DS `Chip` se combinar) + input do valor + CTA "Salvar chave".

**Comportamento (`PixKeyForm`):** props `{ onSaved: () => void }`; consome `useWalletService()` internamente. Validação por tipo: cpf 11 dígitos (máscara `000.000.000-00`), cnpj 14 (`00.000.000/0000-00`), email regex simples, phone 10-11 dígitos (`(00) 00000-0000`), random = valor gerado exibido com input desabilitado. Sucesso → `addPixKey({ type, value })` → toast sucesso → `onSaved()` (as telas fazem `router.back()`).

**Steps 1-4 (TDD):** trocar o tipo muda a máscara/placeholder; cpf incompleto → CTA desabilitado; fluxo feliz cpf → `addPixKey` com o valor digitado e `onSaved` disparado; tipo random → input desabilitado e salvar funciona.

**Step 5: Fidelidade + commit** — `feat(wallet): pix key form and registration screens`

## Task 7: `EarningsLineChart` (Faturamento)

**Files:**
- Create: `components/dashboard/EarningsLineChart.tsx`
- Test: `__tests__/earnings-line-chart.test.tsx`

**Step 0:** node `2602:6429` (earnings-chart). Card branco (radius 16, sombra leve): header "Faturamento" (bold 16 `textPrimary`) + seletor de período DECORATIVO ("30 dias" chip cinza com chevron — estático nesta fase, `TODO(F8)`) à esquerda; total (`formatReais`, 20 bold `surfaceSuccess`) + badge de tendência à direita; corpo: gráfico de LINHA com área preenchida (~132px de altura) + labels do eixo x.

**Implementação:** react-native-svg — `Path`/`Polyline` para a linha (`brand`), `Path` fechado com `fillOpacity` ~0.08 em `colors.brand` para a área (sem token novo), 3-4 `Line` horizontais de grid (`surfaceGrey`), `Circle` no último ponto (`accent`). Props: `{ points: Array<{ label: string; valueCents: number }>; totalCents: number; deltaPct?: number | null }` — normalizar y pelo máximo; `deltaPct` null/undefined → sem badge. Labels x: amostra de até 7 (primeiro/último inclusos). Total exibido = `formatReais(Math.round(totalCents / 100))`. 0 pontos → mensagem "Sem dados no período".

**Steps 1-4 (TDD):** total renderiza (regex nos dígitos — nbsp do BRL); badge some com `deltaPct: null`; labels x renderizam; 0 pontos → mensagem vazia.

**Step 5: Commit** — `feat(dashboard): earnings line chart`

## Task 8: Financeiro do lojista (`app/(merchant)/financeiro/index.tsx`)

**Files:**
- Create: `app/(merchant)/financeiro/index.tsx`
- Modify: `app/(merchant)/_layout.tsx` (ROTAS OCULTAS: `financeiro/index`, `financeiro/withdraw`, `financeiro/new-pix-key`)
- Modify: `app/(merchant)/home/index.tsx` e `app/(merchant)/aqui-agora/index.tsx` (drawers: item `Financeiro` → `/(merchant)/financeiro`)
- Test: `__tests__/merchant-financeiro.test.tsx`

**Step 0:** `get_design_context` nodeIds `2597:5956` (empty) e `2602:5991` (complete). UMA rota, estados guiados pelos dados (padrão F1). Estrutura: `HomeTopBar` (menu → AppDrawer lojista com o novo item Financeiro) · **hero navy** (radius inferior 24): "Saldo disponível" (12 `contentLight`) + valor em `contentPrimaryLight` (32 bold + centavos menores, derivado de `formatBRL(balance)`) + botão outline claro "Solicitar Saque" (borda/texto `contentLight`) → `/(merchant)/financeiro/withdraw` · "Chaves Pix" + `PixKeySection` (add → `/(merchant)/financeiro/new-pix-key`) · "Extrato" + `StatementTimeline` (`getMerchantStatement()`, desc por data, até 4 + ghost "Ver extrato completo" que expande a lista inteira inline — sem rota nova, YAGNI) · `EarningsLineChart` (pontos = soma diária dos CRÉDITOS dos últimos 30 dias derivada do extrato mock; total = soma; `deltaPct: null` — sem baseline honesta no mock) · **`RevenueDonut` (F2, como está)** alimentado por `groupRevenueByService` sobre as entradas `kind === 'service' | 'fura_fila'` (label = title; `amount` em REAIS — dividir cents por 100, o donut formata com `formatReais`).

**Dados:** tudo do `useWalletService()` (decisão #1 — NADA de Supabase aqui); `useFocusEffect` recarrega saldo/extrato ao voltar do saque.

**Steps 1-4 (TDD):** saldo das fixtures renderiza (regex nos dígitos de 591,20); extrato lista as fixtures ("Furou Fila" presente); "Solicitar Saque" navega; donut renderiza "Receita por serviço"; menu abre o drawer com "Financeiro". (O estado vazio do extrato já é coberto no teste do `StatementTimeline` — aqui só o populado; documentar.)

**Step 5: Fidelidade (2 estados) + commit** — `feat(merchant): financeiro screen with balance, statement and charts`

## Task 9: Fluxo de saque (`app/(merchant)/financeiro/withdraw.tsx`)

**Files:**
- Create: `app/(merchant)/financeiro/withdraw.tsx`
- Test: `__tests__/merchant-withdraw.test.tsx`

**Step 0:** `get_design_context` nodeIds `2715:3711` (🆕 preferência visual), `2602:6092` (withdraw), `2622:5836` (loading), `2622:5847` (modal sucesso), `2602:5329` (bottom-sheet de confirmação — avaliar se o 🆕 ainda o usa; se divergir, seguir o 🆕 e registrar a decisão no código).

**Comportamento (uma rota, estados internos):** input de valor (centavos, máscara `R$ 0,00`, teclado numérico) com o saldo disponível visível; seleção da chave Pix de destino (cards das chaves, seleção única); sem chave cadastrada → CTA leva ao cadastro (`/(merchant)/financeiro/new-pix-key`); CTA "Confirmar saque" desabilitado se inválido (0, > saldo, sem chave selecionada); confirmar → estado loading (`2622:5836`) → `requestWithdraw(amountCents, keyId)` → modal de sucesso (`2622:5847`, padrão de `Modal` transparente da F1) → fechar → `router.back()` (o financeiro recarrega via focus). Rejeição do serviço → toast de erro, volta ao formulário.

**Steps 1-4 (TDD):** valor > saldo → CTA desabilitado; sem chave selecionada → desabilitado; fluxo feliz → `requestWithdraw` chamado com centavos + keyId, modal de sucesso aparece, fechar chama `mockBack`; rejeição (spy `mockRejectedValueOnce`) → toast de erro e formulário reexibido.

**Step 5: Fidelidade + commit** — `feat(merchant): withdraw flow with pix key selection and success modal`

## Task 10: Verificação final da fase

**Step 1:** `npx jest --maxWorkers=2` → PASS (baseline 300/37 — só cresce).
**Step 2:** Typecheck + `npm run lint` → 0 erros.
**Step 3:** QA em dispositivo: cliente (wallet → adicionar cartão → adicionar chave) e lojista (financeiro → saque completo com saldo atualizado; estado vazio).
**Step 4:** Fidelidade final vs Figma (`2715:3681`, `2602:5991`, `2715:3711`).
**Step 5:** Atualizar o master plan (§ Fase 3 ✅ implementada + linha na tabela §7, registrando QA pendente).
**Step 6: Commit** — `docs: mark F3 done in new scope master plan`
