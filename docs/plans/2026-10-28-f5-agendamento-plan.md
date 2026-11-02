# F5 (Agendamento com pagamento, cliente) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evoluir o fluxo de agendamento do cliente (loja → busca → serviço → data e hora → confirmação → detalhe) para o desenho da seção `2668:18465`, acrescentando pagamento mock (Pix via sheet da F1, cartão via seleção em pilha + "Processando seu pagamento...") sobre o agendamento REAL do Supabase, sem quebrar o fluxo que já funciona.

**Architecture:** Cobrança continua no `WalletService` (mock, intocado). Nasce o `BookingPaymentService` (`lib/services/bookingTypes.ts` + `MockBookingPaymentService`) que só registra o resultado do pagamento por agendamento (pago via pix/cartão, ou pagar na hora), injetado no `ServicesProvider` como `booking`. O insert no Supabase sai de `confirm.tsx` para `lib/booking/createAppointment.ts` (mesmo comportamento, coberto por teste de caracterização). Ordem na confirmação: cobrar (mock) → gravar agendamento (Supabase) → registrar pagamento (mock). Componentes reaproveitáveis de pagamento em `components/payment/` (arquivos novos); componentes só do agendamento em `components/booking/`. Nenhuma rota nova.

**Tech Stack:** Expo + expo-router · Supabase real (appointments) · `MockWalletService` + `MockBookingPaymentService` · jest + @testing-library/react-native (`renderWithProviders`) · tokens de `lib/theme.ts` · `formatBRL` (centavos).

**Referências:** design doc `docs/plans/2026-10-28-f5-agendamento-design.md` · doc mestre `docs/plans/2026-07-06-novo-escopo-master.md` (§ Fase 5, § 4, § 5) · modelo: `docs/plans/2026-07-11-f4-qi-plan.md`.

**Branch/worktree:** `feat/f5-agendamento` em `.worktrees/f5-agendamento` (criado a partir da `main` = `origin/main` em 28/10; `npm ci` feito; baseline 57 suítes / 463 testes verdes). Nunca trabalhar no diretório principal.

---

## Convenções (idênticas às fases anteriores + regras de paralelismo)

- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`. Suíte autoritativa: `npx jest --maxWorkers=2` (o `npm test` tem flake fantasma de teardown no Windows). Suíte completa só nos marcos (Tasks 2, 6, 10) e nunca ao mesmo tempo que outra sessão; no dia a dia rodar só o arquivo da task.
- Tokens de `lib/theme.ts`; token novo do Figma → adicionar ao theme (só adicionar, nunca mudar valor). Montserrat apenas. Copy e comentários pt-BR. Sem travessão em nenhum texto. Commits SEM atribuição de AI. `git add` e `git commit` em comandos SEPARADOS.
- Step 0 de cada tela: `mcp__claude_ai_Figma__get_design_context` com o nodeId indicado (fileKey `c1QOl8EocqBiGd6R2NzrFn`); screenshot = referência de fidelidade. NUNCA usar URLs de asset do Figma no código.
- Valores monetários em **centavos** (`formatBRL`). `Service.price` do Supabase é em reais: converter com `Math.round(price * 100)` uma única vez (helper `priceToCents` em `lib/booking/money.ts`).
- Testes de tela: `renderWithProviders` de `__tests__/test-utils` (ganha o `booking` na Task 1); `jest.mock('expo-router', ...)` no escopo do módulo de cada teste; mock de `lib/supabase` no padrão de `__tests__/client-home-redesign.test.tsx` (builder encadeável + thenable por tabela), estendido com `insert`, `single`, `maybeSingle` onde a tela precisar.
- **Território:** só editar `app/(client)/schedule/*`, `app/(client)/store/*`, `app/(client)/search/*`, `app/(client)/appointments/[id].tsx`, `components/booking/*`, `lib/booking/*`, `lib/services/bookingTypes.ts`, `lib/services/mock/mockBookingPaymentService.ts`, `components/AppointmentSuccessModal.tsx`, `components/ui/ScheduleConfirmCard.tsx` (remoção) e testes novos. **NÃO tocar:** feed, perfil/assinatura do lojista, `FeedService`, `SubscriptionService`, `lib/services/types.ts`, `app/(client)/_layout.tsx`, drawers, `components/profile/*`, `components/payment/Payment*BottomSheet.tsx`.
- Tasks marcadas **[zona compartilhada]** editam `context/ServicesContext.tsx`, `__tests__/test-utils.tsx` ou `components/payment/*`: só acrescentar (ou mudança retrocompatível no `CardsStack`), sem reformatar nem reordenar o que existe, para o rebase final cair limpo.

---

## Decisões de produto registradas (não re-litigar)

1. **Supabase real continua** para o agendamento; o pagamento é mock e o seu REGISTRO vive no `BookingPaymentService` (design § 4). Sem migration, sem dependência nova.
2. **Cobrar primeiro, gravar depois** (design decisão #3). Cartão recusado não cria agendamento.
3. **`types.ts` intocado**: tipos do agendamento em `lib/services/bookingTypes.ts`, importados direto (sem re-export, para não criar ciclo).
4. **Sub-telas mantêm `AppHeader` com Voltar** (divergência #1 do design).
5. **"Pagar na hora"** grava `pay_on_site` com o método selecionado; "Dinheiro" desabilita "Realizar pagamento".
6. **`schedule/date.tsx` e `appointments/index.tsx` não são tocados** (design decisões #11 e #12).
7. **Fixtures da carteira não mudam** (2 cartões). O `CardsStack` precisa funcionar com N cartões e `activeIndex` interior; o Figma com 3 cartões é divergência registrada (#4).
8. **Sucesso navega para `/(client)/appointments`** (divergência #14).

---

## Task 1: Domínio `BookingPaymentService` (tipos + mock + wiring) [zona compartilhada]

**Files:**
- Create: `lib/services/bookingTypes.ts` · `lib/services/mock/mockBookingPaymentService.ts`
- Modify (aditivo): `context/ServicesContext.tsx` (+ import, `booking` no tipo, `bookingRef`, singleton default, `useBookingPaymentService`) · `__tests__/test-utils.tsx` (+ import, `booking?` em options, criação default, `trackDisposable`, retorno)
- Test: `__tests__/mock-booking-payment-service.test.ts` · estender `__tests__/services-context.test.tsx` (hook novo lança fora do provider e resolve dentro)

**Step 1: Contrato** exatamente como no design § 4.2 (`BookingPaymentMethod`, `BookingPaymentStatus`, `BookingPayment`, `BookingPaymentInput`, `BookingPaymentService`). JSDoc em pt-BR explicando por que o registro é mock (sem coluna no schema até a F8).

**Step 2: Testes que falham** (`mock-booking-payment-service.test.ts`):
- `getPayment(123)` → `null` quando nada foi registrado.
- `recordPayment(123, { status: 'paid', method: 'card', amountCents: 6500, cardLast4: '4242', cardBrand: 'visa' })` → retorna objeto com `appointmentId 123` e `paidAt` ISO não nulo; `getPayment(123)` devolve cópia igual (mutar o retorno não altera o estado).
- `recordPayment(…, { status: 'pay_on_site', method: 'cash', amountCents: 6500, cardLast4: null, cardBrand: null })` → `paidAt null`.
- Regrava: segundo `recordPayment` no mesmo id substitui o primeiro.
- Rejeita: `amountCents <= 0`; `status 'paid'` com `method 'cash'`; `status 'paid'` + `method 'card'` sem `cardLast4`.
- Construtor `{ latencyMs: 0 }` resolve via microtask (await direto, sem timers).

**Step 3:** `npx jest mock-booking-payment-service --maxWorkers=2` → FAIL (módulo inexistente).

**Step 4: Implementar.** `MockBookingPaymentService({ latencyMs? })` com `Map<number, BookingPayment>`, cópias defensivas, `delay()` igual ao `MockWalletService`, `SIMULATED_LATENCY_MS = 300`. Wiring no provider e no harness, copiando o padrão do `qi` linha a linha (sem reordenar os existentes).

**Step 5:** verde + typecheck + commit: `feat(booking): booking payment service with in-memory mock`

## Task 2: `createAppointment` extraído de `confirm.tsx` (teste de caracterização, sem mudança visual)

**Files:**
- Create: `lib/booking/createAppointment.ts` · `lib/booking/money.ts` (`priceToCents`)
- Modify: `app/(client)/schedule/confirm.tsx` (`handleConfirm` passa a chamar `createAppointment` e mapear `BookingError.code` para os toasts atuais; nada mais muda)
- Test: `__tests__/booking-create-appointment.test.ts` · `__tests__/booking-money.test.ts`

**Step 1: Testes que falham** (mock de `lib/supabase` com `auth.getUser` e `from('appointments').insert().select().single()`; `jest.mock('../lib/utils')` para `checkAppointmentConflicts`; `jest.mock('../lib/notifications')` para `notifyAppointmentRequested`):
- Feliz: insert recebe `{ client_id, business_id, service_id, start_time, end_time, status: 'pending', payment_method, client_notes }` com `end_time = start + durationMinutes`; retorna `{ id, startTime, endTime }`; notificação chamada com `(ownerId, id, clientName, serviceName, startTime)`.
- `getUser` sem usuário → `BookingError('unauthenticated')`.
- `time` inválido → `'invalid_time'`; data/hora no passado → `'past_date'`; `checkAppointmentConflicts` com `hasConflict` → `'conflict'`; erro do insert → `'insert_failed'`.
- Notificação rejeitando → NÃO lança (best-effort), retorna normalmente.
- `priceToCents(65)` → 6500; `priceToCents(115.1)` → 11510; `priceToCents(0.07 * 3)` arredonda.

**Step 2:** FAIL. **Step 3:** mover o código de `handleConfirm` para o módulo, mantendo validações e mensagens. `confirm.tsx` vira: `try { await createAppointment(draft); modal } catch (e) { e instanceof BookingError ? toast por code : handleError }`.

**Step 4:** verde + `npx jest --maxWorkers=2` completa (marco: refatoração de código em produção) + typecheck. Commit: `refactor(schedule): extract createAppointment from confirm screen`

## Task 3: `CardsStack` com rank único + `CardSelectionBottomSheet` [zona compartilhada]

**Files:**
- Modify (retrocompatível): `components/payment/CardsStack.tsx`
- Create: `components/payment/CardSelectionBottomSheet.tsx`
- Test: estender `__tests__/payment-components.test.tsx` · criar `__tests__/card-selection-bottom-sheet.test.tsx`

**Step 0:** `get_design_context` nodeId `2668:18327`. Estrutura: alça, título "Meus cartões" (`accent`, bold 16, centrado), `CardsStack` com o ativo à frente, CTA outline navy "Selecionar cartão" (altura 48, radius 24).

**Step 1: Testes que falham.**
- `CardsStack` com 3 cartões e `activeIndex = 1`: os três `cards-stack-card-{i}` têm `translateY` distintos e `zIndex` distintos (hoje colapsam); o ativo tem o maior `zIndex`. Regressão: com `activeIndex = 0` os valores são exatamente `translateY = -index * 22` (comportamento atual).
- Sheet: `visible` lista `cards` na pilha; `selectedCardId` define o ativo; tocar em `cards-stack-card-1` traz o cartão 1 à frente; "Selecionar cartão" chama `onSelect(cardAtivo)`; backdrop chama `onClose`; `visible false` não renderiza; sem cartões mostra "Nenhum cartão salvo" e CTA desabilitado.

**Step 2:** FAIL. **Step 3:** rank = posição do índice na lista ordenada por `(|i - active|, i)`; `translateY = -rank * PEEK_OFFSET`, `scale`/`opacity` por rank, `zIndex = cards.length - rank`. Sheet: `Modal` transparente igual ao `PaymentCardBottomSheet` (mesmos estilos de `root`/`backdrop`/`sheet`/`handle`/`title`), estado `activeIndex` sincronizado com `selectedCardId` ao abrir.

**Step 4:** verde + commit: `feat(payment): card selection bottom sheet; unique depth rank in cards stack`

## Task 4: `PaymentProcessingSheet` [zona compartilhada, aditivo]

**Files:**
- Create: `components/payment/PaymentProcessingSheet.tsx`
- Test: `__tests__/payment-processing-sheet.test.tsx`

**Step 0:** `get_design_context` nodeId `2663:9149`. Sheet claro (`background`), alça, logo de tijolos centrado (`LogoWallToAllSvg` de `lib/assets`), texto bold 16 `textPrimary` "Processando seu pagamento...". Sem backdrop clicável (não pode fechar durante o processamento).

**Step 1:** testes: `visible` renderiza o texto default e o logo (testID `payment-processing-logo`); `message` customizada; `visible false` → nada; `onRequestClose` do Modal é no-op (não há `onClose`).
**Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde + commit: `feat(payment): payment processing sheet`

## Task 5: `BookingConfirmCard` (`components/booking/`)

**Files:**
- Create: `components/booking/BookingConfirmCard.tsx`
- Test: `__tests__/booking-confirm-card.test.tsx`

**Step 0:** `get_design_context` nodeId `2663:8034`. Estrutura: título "Confirmar agendamento" (`accent`, bold) · card `surfacePrimaryExtraLight` radius 16: rótulo "SERVIÇO SOLICITADO" (`accent` 12), nome bold 16, data/hora 12 `textSecondary`, valor bold 20 navy + "A pagar" 8 (mesmo padrão do card do fura-fila) · linha avatar 40 + nome da loja bold · card branco com o endereço · "Selecione o método de pagamento" + `CustomRadioButton` PIX / Cartão / Dinheiro (ícones `IconPix`/`IconCreditCard`/`IconCash`) · linha do método (`surfacePrimaryExtraLight`, radius 4): "Pagamento com Cartão" bold 12 + "•••• last4" + `CardBrandFlag` + "Alterar >" navy; Pix: "Pagamento via PIX" + "QR Code na próxima etapa"; Dinheiro: sem linha · "Observações" + `TextInput` multiline (placeholder vazio, borda `textSecondary` 1px, navy 2px no foco) · CTA primário "Realizar pagamento" com `Icon check_circle` branco · CTA outline "Pagar na hora".

**Props:** ver design § 5.2. `payNowDisabled` cobre dinheiro, ausência de cartão e `submitting`.

**Step 1: Testes que falham:** nome, `formatBRL(priceCents)`, data/hora e loja renderizam · trocar radio chama `onChangeMethod` · com `method 'card'` e `selectedCard` renderiza "•••• 4242" e "Alterar" chama `onChangeCard` · com `method 'card'` e `selectedCard null` renderiza "Nenhum cartão salvo" · com `method 'pix'` renderiza "Pagamento via PIX" sem "Alterar" · com `'cash'` não há linha · "Realizar pagamento" chama `onPayNow`; `payNowDisabled` → `accessibilityState.disabled` · "Pagar na hora" chama `onPayOnSite` · digitar em Observações chama `onChangeObservations`.

**Step 2:** FAIL. **Step 3:** implementar com tokens (sem hex inline; se faltar token do Figma, adicionar ao theme). **Step 4:** verde + commit: `feat(booking): confirm card with payment method row`

## Task 6: Confirmação com pagamento (`confirm.tsx`) + modal de sucesso + remoção do `ScheduleConfirmCard`

**Files:**
- Modify: `app/(client)/schedule/confirm.tsx` · `components/AppointmentSuccessModal.tsx`
- Delete: `components/ui/ScheduleConfirmCard.tsx` (confirmar com `grep -rn ScheduleConfirmCard app components` que só `confirm.tsx` o usa)
- Test: `__tests__/schedule-confirm.test.tsx` · `__tests__/appointment-success-modal.test.tsx`

**Step 0:** `get_design_context` `2663:8057` (modal: check verde `surfaceSuccess` 40, "Agendamento concluído" bold verde, "Fechar" link navy bold 16, sem botão preenchido).

**Step 1: Testes que falham** (`schedule-confirm.test.tsx`: mock de `lib/supabase` com `services`/`business_profiles` via `single()`; `jest.mock('../lib/booking/createAppointment')` resolvendo `{ id: 77 }`; `renderWithProviders` com `wallet` e `booking` latência 0; `jest.useFakeTimers()` para o `PROCESSING_MIN_MS`):
- Carrega serviço (R$ 65,00) e loja; método inicial continua `'pix'` (como hoje); ao escolher Cartão, a linha mostra o default "•••• 4242".
- **Cartão aprovado:** escolher Cartão → "Realizar pagamento" → `PaymentProcessingSheet` visível → `wallet.payWithCard('card_visa_1', 6500, 'Agendamento · Corte …')` chamado → avançar timers → `createAppointment` chamado com `paymentMethod 'card'` → `booking.getPayment(77)` resolve `{ status: 'paid', method: 'card', cardLast4: '4242' }` → modal visível → "Fechar" → `router.replace('/(client)/appointments')`.
- **Cartão recusado:** `jest.spyOn(wallet, 'payWithCard').mockResolvedValue({ status: 'declined' })` → toast "Pagamento recusado. Tente outro cartão." → `createAppointment` NÃO chamado → sheet fechado, formulário visível.
- **Pix:** "Realizar pagamento" abre `PaymentPixBottomSheet` (texto "Pagamento via PIX"); "Já realizei o pagamento" (+ timers) → `createAppointment` com `'pix'` → `getPayment(77).status === 'paid'` → modal.
- **Pagar na hora:** com Dinheiro → "Realizar pagamento" desabilitado; "Pagar na hora" → `createAppointment` com `'cash'` → `getPayment(77)` `pay_on_site` → modal.
- **Alterar:** escolher Cartão → "Alterar" abre o sheet "Meus cartões" → tocar no 2º cartão → "Selecionar cartão" → linha mostra "•••• 5454".
- **Sem cartão:** `wallet.getCards` resolvendo `[]` + Cartão → "Nenhum cartão salvo" e CTA desabilitado.
- **Erro de criação:** `createAppointment` rejeitando `BookingError('conflict')` → toast "Selecione outro horário, este já está ocupado." e nenhum registro de pagamento.
- Modal: "Fechar" chama `onClose`; texto "Agendamento concluído".

**Step 2:** FAIL. **Step 3:** implementar a orquestração do design § 4.4 (`PROCESSING_MIN_MS = 600`, `delay` local), remover `ScheduleConfirmCard`, evoluir o modal.

**Step 4:** verde + `npx jest --maxWorkers=2` completa (marco) + typecheck + fidelidade vs `2663:8034`, `2668:18327`, `2663:9149`, `2663:8057`. Commit: `feat(schedule): confirm with mock payment (pix, card, pay on site)`

## Task 7: `service.tsx` e `time.tsx` (CTA sempre visível, textos)

**Files:**
- Modify: `app/(client)/schedule/service.tsx` · `app/(client)/schedule/time.tsx`
- Test: `__tests__/schedule-service.test.tsx` · `__tests__/schedule-time.test.tsx`

**Step 0:** `get_design_context` `2663:7937` + `2663:7960` (serviço) e `2663:7983` + `2663:8015` (data e hora). CTA desabilitado: cinza (`disabled`) no serviço, azul claro (`surfacePrimaryLight`) na hora; conferir no get_design_context e usar `CustomButton` com `disabled` (se o estilo desabilitado do `CustomButton` não cobrir, adicionar `style` com token, nunca hex).

**Step 1: Testes que falham** (mock de `lib/supabase` com `services` → 3 serviços; para `time.tsx`, `business_profiles.single()` com `work_days` seg a sex 10h-18h e `lunch_break` 12-13, `services.single()` com `duration_minutes 60`, `appointments` vazio; `jest.mock('../lib/utils')` para `applyAcceptedReschedules` identidade):
- Serviço: título "Serviços disponíveis"; "Continuar" presente e `disabled` sem seleção; tocar num card habilita; "Continuar" → `router.push({ pathname: '/(client)/schedule/time', params: { businessId, serviceId } })`.
- Hora: "Continuar" presente e `disabled` sem slot; slot "12h às 13h" marcado "Almoço" e desabilitado; tocar "10h às 11h" habilita; "Continuar" → push para `confirm` com `date` e `time: '10:00'`.

**Step 2:** FAIL. **Step 3:** mover o CTA para footer fixo com `disabled={!selected}`; corrigir título. **Step 4:** verde + fidelidade + commit: `feat(schedule): always-visible continue cta on service and time steps`

## Task 8: Status do pagamento no detalhe do agendamento

**Files:**
- Create: `components/booking/BookingPaymentStatusRow.tsx`
- Modify: `app/(client)/appointments/[id].tsx` (carrega `booking.getPayment(appointmentId)` junto do `loadAppointment`, estado `payment`, renderiza a linha logo abaixo do `cardWrapper`; falha do `getPayment` → `null`, nunca derruba a tela)
- Test: `__tests__/booking-payment-status-row.test.tsx` · `__tests__/client-appointment-detail-payment.test.tsx`

**Step 1: Testes que falham:** linha com `{ status: 'paid', method: 'card', cardLast4: '4242' }` → "Pago com cartão •••• 4242"; `paid`/`pix` → "Pago via Pix"; `pay_on_site`/`card` → "Pagar na hora (Cartão)"; `null` + `fallbackMethod 'pix'` → "Pagamento: Pix". Tela: com registro no `booking` injetado mostra "Pago com cartão •••• 4242"; sem registro mostra o fallback do `payment_method` do appointment mockado.

**Step 2:** FAIL. **Step 3:** implementar (ícone por método com `IconPix`/`IconCreditCard`/`IconCash`, texto 14 `textPrimary`, card branco radius 12). **Step 4:** verde + commit: `feat(appointments): payment status row fed by booking service`

## Task 9: Passada de fidelidade: loja, busca e resultados (sem mudança de comportamento)

**Files:**
- Modify: `app/(client)/store/[id].tsx` · `app/(client)/search/index.tsx` · `app/(client)/search/results.tsx` (só estilos/tokens/espaçamento)

**Step 0:** `get_design_context` `2663:7158`, `2663:7806`, `2663:7678` e comparar com screenshot de cada tela rodando. Lista provável: título "Serviços" (`accent` bold 16, margem 24), gap 16 entre cards, CTAs 48/radius 24; chips de categoria com borda navy 1px e texto 12 medium; "Principais resultados"/"Principais serviços" (`accent` bold 16).
**Step 1:** sem teste novo quando a mudança for só visual (registrar no commit). Se algum ajuste alterar comportamento (ex.: navegação), escrever o teste antes.
**Step 2:** fidelidade visual + lint + commit: `style(client): store, search and results aligned with figma f5`

## Task 10: Verificação final, rebase e PR

1. `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` → 0 erros. `npm run lint` → nenhum problema novo. `npx jest --maxWorkers=2` → todas verdes (baseline 463 só cresce).
2. QA em dispositivo (fluxo ponta a ponta): home → loja → serviço → hora → confirmar com cartão (processando → concluído → lista) · confirmar com Pix (sheet → concluído) · pagar na hora com Dinheiro · cartão recusado (forçar com id desconhecido no mock) · detalhe mostra a linha de status · voltar de cada passo.
3. Fidelidade final vs `2663:7158`, `2663:7678`, `2663:7806`, `2663:7937`/`2663:7960`, `2663:7983`/`2663:8015`, `2663:8034`, `2668:18327`, `2663:9149`, `2663:8057`, contra a tabela de 15 divergências do design § 6.
4. **Rebase na main** (quem termina depois rebase e resolve): `git fetch origin` → `git rebase origin/main`. Conflitos esperados só em `context/ServicesContext.tsx`, `__tests__/test-utils.tsx` e, se a F7 encostou, `components/payment/*`: resolver mantendo as duas adições (nunca descartar a da outra fase). Rodar typecheck + suíte de novo após o rebase.
5. `git push -u origin feat/f5-agendamento` e abrir o PR (`gh pr create`, sem rodapé de AI) com: resumo, tabela de divergências, dívidas F8, lista das zonas compartilhadas tocadas.
6. **Depois do merge, na main:** atualizar o doc mestre (§ Fase 5 ✅ + linha na § 7). Não fazer isso nesta branch (decisão de paralelismo #6).

**Commits:** um por task (mensagens acima); `docs: f5 booking design and plan` já no início da branch.
