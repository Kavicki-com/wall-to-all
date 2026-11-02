# F8 (Pagamentos reais com Stripe, test mode) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trocar o dinheiro mock do app (fura-fila, carteira, agendamento, Financeiro, saques, QI) por cobranças reais da Stripe em **test mode**, para o piloto e a demo ao cliente, mantendo as telas atrás das interfaces de serviço e com o webhook como única fonte da verdade do pagamento.

**Architecture:** Tudo que usa a secret key roda em Supabase Edge Functions (Deno): `payments-cards`, `payments-create-intent`, `payments-cancel`, `stripe-webhook`, `connect-onboarding`, `connect-return`, `wallet-withdraw` (e `subscriptions`, opcional). Regras puras (preço, taxa, ledger, status, idempotência, fluxo de fundos) ficam em `supabase/functions/_shared/` sem imports de URL, cobertas pelo jest. Postgres ganha `payments`, `ledger_entries`, `withdrawals`, `merchant_accounts`, `psp_customers`, `pix_keys` e `stripe_events`, com RLS (escrita só por service role ou RPC `security definer`). No app, `StripeWalletService`, `StripeBookingPaymentService` e `StripeQiService` (em `lib/services/stripe/`) implementam as interfaces existentes ao lado dos mocks; o `ServicesProvider` escolhe pela env `EXPO_PUBLIC_PAYMENTS_PROVIDER`. Cartão via `@stripe/stripe-react-native` (`CardField`, `confirmSetupIntent`, `handleNextAction`); Pix pelo `next_action` do PaymentIntent. Agendamento passa a **reservar, depois cobrar**. Connect marketplace: destination charge onde o spike permitir, cobrança na plataforma + transfer como fallback.

**Tech Stack:** Expo SDK 54 + expo-router · Supabase (Postgres, RLS, Edge Functions Deno, Management API) · Stripe API (test mode, Connect, PaymentIntents, SetupIntents, Transfers, Payouts, Billing opcional) via `npm:stripe` no Deno · `@stripe/stripe-react-native` · jest + @testing-library/react-native (`renderWithProviders`) · valores em centavos (`formatBRL`).

**Referências:** design doc `docs/plans/2026-11-02-f8-pagamentos-stripe-design.md` · doc mestre `docs/plans/2026-07-06-novo-escopo-master.md` (§ Fase 8, § 4, § 6) · modelo de formato: `docs/plans/2026-10-28-f5-agendamento-plan.md` (na branch da F5) · contratos: `lib/services/types.ts`, `lib/services/bookingTypes.ts` (F5) · harness: `__tests__/test-utils.tsx`, `context/ServicesContext.tsx`.

**Branch/worktree:** `feat/f8-pagamentos-stripe` em `.worktrees/f8-pagamentos-stripe` (criado de `origin/main` em 02/11 só com estes docs). Nunca trabalhar no diretório principal.

---

## Pré-requisitos (antes da Task 1)

1. **F5 mergeada na `main`.** A execução só começa depois do merge de `feat/f5-agendamento` (traz `BookingPaymentService`, `lib/booking/*`, `components/payment/CardSelectionBottomSheet.tsx` e `PaymentProcessingSheet.tsx`). No worktree: `git fetch origin` → `git rebase origin/main` → conferir `ls lib/services/bookingTypes.ts lib/booking/createAppointment.ts`.
2. `npm ci` no worktree. Medir a baseline: `npx jest --maxWorkers=2` (anotar suítes/testes; a F4 deixou 463/57 e a F5 acrescenta) e `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` (0 erros).
3. Se F6/F7 estiverem em andamento em paralelo, combinar território: esta fase edita `lib/services/types.ts`, `context/ServicesContext.tsx`, `__tests__/test-utils.tsx` e `components/payment/*` só de forma aditiva.

## Convenções (idênticas às fases anteriores + regras de dinheiro real)

- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`. Suíte autoritativa: `npx jest --maxWorkers=2` (o `npm test` tem flake fantasma de teardown no Windows: "N failed suites" com 0 testes falhos é crash de worker, rodar de novo). Suíte completa só nos marcos (Tasks 3, 9, 11, 13, 15, 19); no dia a dia, só o arquivo da task.
- Copy, comentários e docs em pt-BR. **Sem travessão** em nenhum texto (código, comentário, commit, doc). Commits **sem nenhuma atribuição** (sem `Co-Authored-By`, sem rodapé "Generated with"). `git add` e `git commit` em comandos **separados**. Nunca `git stash` puro (o stash é compartilhado entre worktrees).
- Tokens de `lib/theme.ts`, Montserrat. Step 0 de task com UI: `mcp__claude_ai_Figma__get_design_context` (fileKey `c1QOl8EocqBiGd6R2NzrFn`) no node indicado.
- **Segredos:** a secret key e os signing secrets do webhook **nunca** passam pelo agente: o usuário digita no terminal dele (`npx supabase secrets set ...`) e no dashboard. Nada de `sk_`/`whsec_` em `.env`, código, teste, log, commit ou conversa. O agente só manipula a publishable key (`pk_test_...`, pública por definição) e só via `.env` local.
- **Supabase:** projeto `yykqzdiktqlzmvnnokfj`. O conector MCP do claude.ai está em outra conta; migrations e SQL vão pela Management API com PAT do usuário (`POST https://api.supabase.com/v1/projects/yykqzdiktqlzmvnnokfj/database/query`), PAT revogado depois. Todo SQL aplicado vira arquivo versionado em `supabase/migrations/`. Deploy de função: `npx supabase functions deploy <nome> --project-ref yykqzdiktqlzmvnnokfj --use-api [--no-verify-jwt]` depois de `npx supabase login` (CLI 2.x roda via `npx`, sem instalação global; `--use-api` dispensa Docker).
- **Edge Functions:** `Deno.serve`; Stripe via `npm:stripe@<versão do spike>` com `Stripe.createFetchHttpClient()`; `apiVersion` fixada na versão registrada no spike. Lógica testável em `supabase/functions/_shared/*.ts` **pura** (sem `Deno.*`, sem import de URL, imports relativos com extensão `.ts`), importada pelos testes jest em `__tests__/edge-*.test.ts`. Handler fino. Opcional: `npx --yes deno check supabase/functions/<nome>/index.ts`.
- Testes de serviço Stripe: mock de `lib/supabase` (`functions.invoke`, `from().select()...`, `rpc`) e do SDK via `__mocks__/@stripe/stripe-react-native.js` (Task 9). Testes de tela continuam com `renderWithProviders` e mocks de latência 0; `jest.mock('expo-router', ...)` por arquivo.
- Passos marcados **[USUÁRIO]** dependem do Gabriel (credenciais, dashboard, deploy com credenciais, rebuild, QA em dispositivo). O agente prepara comandos e para, esperando confirmação.
- **Build nativo no Windows:** antes de qualquer build, `Get-CimInstance Win32_OperatingSystem | Select-Object FreeVirtualMemory` precisa mostrar >= 6-8 GB livres (o crash do Gradle é limite de commit, não RAM); se baixo, pedir para fechar apps, nunca matar processos. Gradle com `--max-workers=2`. Alternativa sem memória local: `eas build --profile development --platform android`.

---

## Decisões registradas (não re-litigar; detalhe no design § 1)

1. **Stripe test mode** no piloto e na demo; produção decidida depois (pesquisa: Asaas). Código Stripe confinado a `supabase/functions/*` e `lib/services/stripe/*`; schema com nomes neutros (`provider*`).
2. **Interfaces de serviço mantidas.** Implementações Stripe ao lado dos mocks; mocks continuam no jest; troca no `ServicesContext` por `EXPO_PUBLIC_PAYMENTS_PROVIDER` (default `mock`).
3. **Sandbox** `acct_1UX9o33seqKLeNs2`, Connect marketplace, conta conectada de teste `acct_1UXBoK3seq5yk1Fo` (BR). Métodos: cartão, Apple Pay, Google Pay, Link, Pix (boleto desligado). Apple/Google Pay e Link fora do piloto.
4. **Chaves:** publishable no `.env` (já existe); secret criada pelo usuário na Task 1 e só em secrets do Supabase (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`). `.env.example` só com nomes.
5. **Secret só em Edge Functions.** App com `@stripe/stripe-react-native` (rebuild do dev client).
6. **Webhook é a verdade.** "Aprovado" na UI = `payments.status = 'succeeded'` lido do banco.
7. **Valores de negócio indefinidos:** usar os dos mocks (fura-fila 1500, cashback 10%, saque R$ 5,00 abaixo de R$ 200,00, mínimo QI R$ 30,00) e taxa da plataforma `PLATFORM_FEE_BPS` default 0. Lista completa no design § 13.
8. **Fora do escopo:** vídeo, mapas, fila em tempo real. Assinatura é a Task 17, opcional, depende da F7.
9. **Pix + Connect não confirmado:** spike na Task 1; fallback = Pix na plataforma + ledger + transfer separado.
10. **Agendamento reserva antes de cobrar** (inverte a decisão #3 da F5, como ela previu). Um PaymentIntent por agendamento; nova tentativa reconfirma o mesmo PI.

---

## Task 1: Spike Stripe (Connect, Pix, transfers, payouts) **[USUÁRIO + agente]**

**Files:**
- Create: `scripts/stripe-spike/spike.sh` (curl; lê `STRIPE_SECRET_KEY` do ambiente do shell; nunca grava a chave)
- Modify: `docs/plans/2026-11-02-f8-pagamentos-stripe-design.md` (nova § 16 "Resultado do spike"; ajustar § 3 e § 12 conforme o resultado)

**Step 1 [USUÁRIO]: criar a secret key de teste.** Dashboard da Stripe → sandbox "Área restrita de Wall to All" → Developers → API keys → revelar/criar a secret key (`sk_test_...`). Não colar no chat. No terminal do próprio usuário (Git Bash): `export STRIPE_SECRET_KEY=sk_test_...`. É o mesmo valor que irá para os secrets do Supabase na Task 4.

**Step 2: escrever o script** (o agente escreve; o usuário roda no terminal onde a variável existe). Cada bloco imprime `PASS`/`FAIL`, ids e a mensagem de erro da Stripe, nunca a chave. Moeda `brl`, conta conectada `acct_1UXBoK3seq5yk1Fo`:
- (a) Cartão + destination charge: `POST /v1/payment_intents` `amount=6500`, `payment_method=pm_card_visa`, `payment_method_types[]=card`, `confirm=true`, `transfer_data[destination]=acct_1UXBoK3seq5yk1Fo`, `application_fee_amount=650`. Esperado: `status=succeeded` e `latest_charge.transfer` presente. Se falhar por `on_behalf_of`/capability, repetir com `on_behalf_of` e registrar.
- (b) Pix sem Connect: `payment_method_types[]=pix`, `payment_method_data[type]=pix`, `payment_method_options[pix][expires_after_seconds]=900`, `confirm=true`. Esperado: `requires_action` com `next_action.type=pix_display_qr_code` (`data`, `image_url_png`, `hosted_instructions_url`, `expires_at`). Registrar campos obrigatórios (`billing_details` nome/e-mail/CPF).
- (b2) **[USUÁRIO]** abrir o `hosted_instructions_url` no navegador e usar "simulate scan" (aprovar). Script faz `GET /v1/payment_intents/{id}` → `succeeded`. Repetir simulando falha/expiração e registrar o status final.
- (c) Pix + destination charge: (b) com `transfer_data[destination]` e `application_fee_amount`. Registrar se é aceito.
- (d) Transfer da plataforma: PI com `pm_card_bypassPending` (saldo disponível na hora) e depois `POST /v1/transfers` `amount=1000`, `destination=acct_...`; repetir com `source_transaction=ch_...`.
- (e) Reversão parcial: `POST /v1/transfers/{tr de (a)}/reversals` `amount=500`.
- (f) Payout na conta conectada: `POST /v1/accounts/acct_...` com `settings[payouts][schedule][interval]=manual` e `POST /v1/payouts` `amount=1000` com header `Stripe-Account: acct_...`. Registrar se a conta tem conta bancária externa de teste e saldo disponível.
- (g) Conta nova + link: `POST /v1/accounts` (`country=BR`, `capabilities[transfers][requested]=true`, tipo/controller coerente com o perfil marketplace do dashboard) e `POST /v1/account_links` (`type=account_onboarding`, URLs https de teste). Registrar se aceitou e quais capabilities o BR exige.
- (h) Customer + SetupIntent: `POST /v1/customers`, `POST /v1/setup_intents` (`customer`, `payment_method_types[]=card`, `usage=on_session`), `confirm` com `pm_card_visa`, `GET /v1/customers/{id}/payment_methods?type=card`.
- Registrar a `Stripe-Version` devolvida nos headers e a versão do pacote `stripe` no npm que será fixada no Deno.

**Step 3 [USUÁRIO]:** rodar `bash scripts/stripe-spike/spike.sh` e colar no chat **apenas a saída** (que não contém segredos).

**Step 4: registrar a decisão** na § 16 do design: tabela método x fluxo de fundos (`destination` ou `platform`) para booking cartão, booking Pix, fura-fila, saque Financeiro (reversal ou transfer), saque QI; API version; campos obrigatórios do Pix; procedimento de simulação do Pix. **Portão:** se (a) falhar também com `on_behalf_of`, parar e levar ao usuário (o modelo inteiro vira B).

**Step 5: commit**
```bash
git add scripts/stripe-spike/spike.sh docs/plans/2026-11-02-f8-pagamentos-stripe-design.md
```
```bash
git commit -m "docs(f8): stripe connect and pix spike results"
```

## Task 2: Migration de pagamentos (tabelas, enums, RLS, RPCs) **[USUÁRIO para aplicar]**

**Files:**
- Create: `supabase/migrations/20261102120000_f8_payments.sql` · `supabase/tests/f8_payments_rls.sql`
- Modify: `supabase/types.ts` (tipos das tabelas, views e RPCs novas)

**Step 1: teste primeiro** (`supabase/tests/f8_payments_rls.sql`): bloco `BEGIN ... ROLLBACK` que semeia usuários e negócio sintéticos (uuids fixos de teste, nada de dado real) e, com `set local role authenticated` + `set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`, faz asserções (blocos `DO $$ ... $$` que dão `RAISE EXCEPTION` na falha):
- cliente A só enxerga os próprios `payments`; o dono do negócio enxerga os do seu `merchant_business_id`; cliente B não enxerga nada de A;
- `authenticated` não consegue `INSERT/UPDATE` em `payments`, `ledger_entries`, `withdrawals`, `merchant_accounts`, `stripe_events`;
- `select value from pix_keys` falha para `authenticated`; `my_pix_keys` devolve só `masked_value`; `add_pix_key('cpf','123.456.789-12')` grava `*********-12`;
- `record_pay_on_site` grava para o cliente do agendamento e falha para outro usuário;
- segunda cobrança viva para o mesmo `appointment_id` viola o índice parcial; lançamento duplicado `(payment_id, account, kind)` viola o unique;
- `merchant_balance_cents` soma o ledger do dono e lança para quem não é dono.

**Step 2 [USUÁRIO/PAT]:** checar extensões: `select name, installed_version from pg_available_extensions where name in ('pg_cron','pgcrypto')`. Define se a limpeza de reservas vira cron (design § 5).

**Step 3: escrever a migration** conforme o design § 5: enums (`payment_purpose`, `payment_status`, `funds_flow`, `ledger_account`, `ledger_kind`, `withdrawal_source`, `withdrawal_status`, `pix_key_type`), tabelas, índices (inclusive `payments (payer_id, created_at desc)` e `ledger_entries (business_id, account, created_at desc)`), RLS com `(select auth.uid())`, funções `security definer` com `set search_path = public` e `revoke ... from public, anon` (padrão de `20260706120000_security_hardening.sql`): `merchant_balance_cents`, `my_qi_balance_cents`, `apply_payment_event`, `release_unpaid_appointments`, `record_pay_on_site`, `add_pix_key`. Se houver `pg_cron`: `cron.schedule('release-unpaid-appointments', '*/10 * * * *', ...)` com prazo de 30 min.

**Step 4 [USUÁRIO/PAT]:** aplicar a migration pela Management API (retry se vier 500 de Redis OOM) e rodar o script de teste: esperado sem exceção. `GET /v1/projects/yykqzdiktqlzmvnnokfj/advisors/security`: nenhum aviso novo sobre as tabelas criadas.

**Step 5:** atualizar `supabase/types.ts` (gerar com `npx supabase gen types typescript --project-id yykqzdiktqlzmvnnokfj` se logado; senão acrescentar à mão só as tabelas/funções novas) + typecheck.

**Step 6: commit**
```bash
git add supabase/migrations/20261102120000_f8_payments.sql supabase/tests/f8_payments_rls.sql supabase/types.ts
```
```bash
git commit -m "feat(db): payments, ledger, connect accounts and withdrawals tables"
```

## Task 3: Regras puras compartilhadas das Edge Functions

**Files:**
- Create: `supabase/functions/_shared/pricing.ts` · `fundsFlow.ts` · `ledger.ts` · `statusMap.ts` · `idempotency.ts`
- Test: `__tests__/edge-pricing.test.ts` · `__tests__/edge-funds-flow.test.ts` · `__tests__/edge-ledger.test.ts` · `__tests__/edge-status-map.test.ts`

**Step 1: testes que falham.**
- `pricing`: `priceToCents(65)` → 6500 e `priceToCents(115.1)` → 11510 (paridade com `lib/booking/money.ts` da F5, importando os dois); `platformFeeCents(6500, 1000)` → 650; bps 0 → 0; arredondamento para baixo a favor do lojista; `quoteWithdraw(x)` igual a `computeWithdrawQuote(x)` de `lib/services/mock/withdrawQuote.ts` para 3000, 19999, 20000 e 59120 (mesma régua no app e no servidor); valor não inteiro lança.
- `fundsFlow`: booking + cartão + conta `payouts_enabled` → `destination`; booking + Pix → `destination` só se `pixDestinationSupported` (flag vinda do spike), senão `platform`; lojista sem conta ativa → `platform`; fura-fila → `platform`; `pay_on_site` → `none`.
- `ledger`: `entriesForSucceeded` de booking destination 6500 com taxa 650 → `merchant +5850 service` e `platform +650 platform_fee`; fura-fila `platform` com `demoBusinessId` → `merchant` `fura_fila` líquido; sem `demoBusinessId` → só `platform`; `entriesForRefund` espelha com sinal invertido; `entriesForWithdraw` Financeiro 10000 com taxa 500 → `merchant -10000 withdraw` e `platform +500 withdraw_fee`; QI cliente → `client_qi -amount qi_withdraw`; títulos/subtítulos iguais aos do mock ("Furou Fila", "Taxa de antecipação Fura Fila", "Saque").
- `statusMap`: status do PaymentIntent → `payment_status`; `canTransition` só avança (`processing → succeeded` sim; `succeeded → processing` não; `succeeded → refunded` sim).
- `idempotency`: chaves determinísticas `pi:`, `confirm:{id}:{n}`, `transfer:`, `payout:`, `reversal:`, `acct:`, `cus:`.

**Step 2:** `npx jest edge- --maxWorkers=2` → FAIL (módulos inexistentes).
**Step 3:** implementar (sem imports de URL nem `Deno`).
**Step 4:** verde + suíte completa (marco: primeiros testes importando `supabase/functions`) + typecheck.
**Step 5: commit**
```bash
git add supabase/functions/_shared __tests__/edge-pricing.test.ts __tests__/edge-funds-flow.test.ts __tests__/edge-ledger.test.ts __tests__/edge-status-map.test.ts
```
```bash
git commit -m "feat(payments): pure pricing, ledger and status rules for edge functions"
```

## Task 4: Infra das Edge Functions + `payments-cards` (Customer, cartões, SetupIntent)

**Files:**
- Create: `supabase/functions/_shared/cors.ts` · `http.ts` · `auth.ts` · `admin.ts` · `stripe.ts` · `cardMapper.ts` · `supabase/functions/payments-cards/index.ts`
- Test: `__tests__/edge-card-mapper.test.ts`

**Step 1: testes que falham** (`cardMapper`, puro): `pm` Visa `exp_month 8 exp_year 2028` → `{ id: 'pm_...', brand: 'visa', last4, expiry: '08/28', holderName: billing_details.name em maiúsculas ou '', isDefault }`; Mastercard/Amex/Elo mapeados; bandeira fora de `CardBrand` é filtrada (o piloto usa cartões de teste Visa/Mastercard); default vem de `invoice_settings.default_payment_method`.

**Step 2:** FAIL. **Step 3:** implementar. `payments-cards`: `GET` garante Customer (`psp_customers`, chave `cus:{userId}`) e lista; `POST {action:'setup'}` devolve `client_secret` do SetupIntent; `POST {action:'complete', setupIntentId}` confere `status=succeeded` e `customer` do caller, define default se for o primeiro, devolve `PaymentCard`.

**Step 4 [USUÁRIO]:** `npx supabase login` e, no terminal do usuário, `npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref yykqzdiktqlzmvnnokfj`; depois `npx supabase functions deploy payments-cards --project-ref yykqzdiktqlzmvnnokfj --use-api`.

**Step 5: verificação manual:** `curl -H "Authorization: Bearer <JWT de um usuário de teste>" .../functions/v1/payments-cards` → `[]`; Dashboard → Customers mostra o Customer criado.

**Step 6: commit**
```bash
git add supabase/functions/_shared supabase/functions/payments-cards __tests__/edge-card-mapper.test.ts
```
```bash
git commit -m "feat(payments): edge function for saved cards and setup intents"
```

## Task 5: `payments-create-intent` e `payments-cancel`

**Files:**
- Create: `supabase/functions/_shared/intentParams.ts` · `pixNextAction.ts` · `supabase/functions/payments-create-intent/index.ts` · `supabase/functions/payments-cancel/index.ts`
- Test: `__tests__/edge-intent-params.test.ts`

**Step 1: testes que falham.**
- `buildIntentParams`: booking + cartão + `destination` → `amount` do servidor, `currency: 'brl'`, `customer`, `payment_method`, `confirm: true`, `return_url: 'walltoall://stripe-redirect'`, `transfer_data.destination`, `application_fee_amount`, `metadata { payment_id, purpose, appointment_id }`; `platform` → sem `transfer_data`; Pix → `payment_method_types: ['pix']`, `expires_after_seconds: 900`, `billing_details` conforme o spike; fura-fila acima de `FURA_FILA_MAX_CENTS` → erro `amount_out_of_range`; booking com `amountCents` do app diferente do servidor → `amount_mismatch`.
- `parsePixNextAction` → `{ copyPasteCode, qrImageUrl, expiresAt }`; `next_action` ausente → erro.

**Step 2:** FAIL. **Step 3:** implementar. Handler: autentica; booking exige `appointments.client_id = caller` e status `pending`; insere `payments` por `idempotency_key` (`on conflict do nothing` + select); linha já `succeeded` → devolve sem chamar a Stripe; linha com PI e cartão novo → `paymentIntents.update` + `confirm` (`confirm:{id}:{n}`); sem PI → `create` (`pi:{id}`). Resposta `{ paymentId, status, clientSecret?, pix? }`. `payments-cancel`: dono do agendamento; cancela PI não pago; `appointments.status = 'canceled'`; `payments.status = 'canceled'`; idempotente.

**Step 4 [USUÁRIO]:** `npx supabase secrets set PLATFORM_FEE_BPS=0 FURA_FILA_MAX_CENTS=20000 --project-ref ...` e deploy das duas funções.

**Step 5: verificação manual:** com um agendamento de teste e o cartão salvo na Task 4, `curl` cria a cobrança: Dashboard mostra o PI com `transfer_data` (ou sem, conforme o spike) e `metadata.payment_id`; a mesma chamada repetida devolve o mesmo `paymentId` (um único PI).

**Step 6: commit**
```bash
git add supabase/functions/_shared supabase/functions/payments-create-intent supabase/functions/payments-cancel __tests__/edge-intent-params.test.ts
```
```bash
git commit -m "feat(payments): create and cancel payment intents for card and pix"
```

## Task 6: `stripe-webhook` (assinatura, dedupe, ledger) **[USUÁRIO para endpoints e secrets]**

**Files:**
- Create: `supabase/functions/_shared/webhookPlan.ts` · `supabase/functions/stripe-webhook/index.ts`
- Test: `__tests__/edge-webhook-plan.test.ts` (eventos de fixture sintéticos, ids fake)

**Step 1: testes que falham** (`planForEvent(event, ctx)` → operações: `updatePayment`, `ledger[]`, `cancelAppointment`, `notifyMerchant`, `updateAccount`, `updateWithdrawal`):
- `payment_intent.succeeded` booking destination → status `succeeded`, `card_last4`/`card_brand` do charge, ledger da Task 3, `notifyMerchant` com `appointment_id`;
- `payment_intent.succeeded` fura-fila com e sem `demoBusinessId`;
- `payment_intent.payment_failed` cartão → `failed` + `failure_code`, sem ledger;
- `payment_intent.canceled` booking Pix → `canceled` + `cancelAppointment`;
- `charge.refunded` → `refunded` + ledger invertido;
- `account.updated` → flags; `payout.paid`/`payout.failed` → withdrawal (falha devolve o débito no ledger);
- evento desconhecido → nenhuma operação; evento antigo depois de `succeeded` (`processing`) → ignorado por `canTransition`.

**Step 2:** FAIL. **Step 3:** implementar. Handler: `await req.text()` (corpo cru), `constructEventAsync` tentando `STRIPE_WEBHOOK_SECRET` e depois `STRIPE_CONNECT_WEBHOOK_SECRET`; `insert into stripe_events` (já processado → 200); `rpc('apply_payment_event', ...)`; `processed_at`; falha → `error` + 500. Notificação ao lojista via `insert_notification` (service role), mesma copy de `notifyAppointmentRequested`.

**Step 4 [USUÁRIO]:**
1. `npx supabase functions deploy stripe-webhook --project-ref yykqzdiktqlzmvnnokfj --use-api --no-verify-jwt`.
2. Dashboard → Developers → Webhooks → endpoint **"Your account"** em `https://yykqzdiktqlzmvnnokfj.supabase.co/functions/v1/stripe-webhook` com `payment_intent.succeeded`, `.processing`, `.requires_action`, `.payment_failed`, `.canceled`, `charge.refunded`, `charge.dispute.created`, `setup_intent.succeeded`.
3. Segundo endpoint **"Connected accounts"** na mesma URL com `account.updated`, `payout.paid`, `payout.failed`, `account.application.deauthorized`.
4. `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_CONNECT_WEBHOOK_SECRET=whsec_... --project-ref ...` (valores copiados de cada endpoint, digitados pelo usuário).

**Step 5: verificação manual:** repetir a cobrança da Task 5 → `payments.status = succeeded` e lançamentos no ledger; no Dashboard, "Resend" do mesmo evento → contagem de `ledger_entries` não muda; `stripe_events.processed_at` preenchido.

**Step 6: commit**
```bash
git add supabase/functions/_shared supabase/functions/stripe-webhook __tests__/edge-webhook-plan.test.ts
```
```bash
git commit -m "feat(payments): stripe webhook with event dedupe and ledger"
```

## Task 7: Onboarding Connect do lojista **[USUÁRIO para deploy e vínculo da conta demo]**

**Files:**
- Create: `supabase/functions/_shared/accountFlags.ts` · `returnPage.ts` · `supabase/functions/connect-onboarding/index.ts` · `supabase/functions/connect-return/index.ts`
- Test: `__tests__/edge-connect.test.ts`

**Step 1: testes que falham:** `accountFlags(account)` → `{ chargesEnabled, payoutsEnabled, detailsSubmitted, requirementsDue }` e status do app (`active` só com `payouts_enabled`; `pending` com conta e pendências; `none` sem conta); `returnPage(deepLink)` gera HTML com o deep link escapado (`walltoall://financeiro?onboarding=done`) e sem dado do usuário.

**Step 2:** FAIL. **Step 3:** implementar. `connect-onboarding`: exige dono de `business_profiles`; `POST {action:'link'}` cria a conta se não houver (parâmetros validados no spike, payouts manuais, chave `acct:{businessId}`), grava `merchant_accounts`, devolve `{ url }` do Account Link; `POST {action:'sync'}` relê a conta e atualiza flags; `GET` devolve o status. `connect-return`: `?state=done` → página de retorno; `?state=refresh` → orienta reabrir pelo app.

**Step 4 [USUÁRIO]:** `npx supabase secrets set CONNECT_RETURN_BASE_URL=https://yykqzdiktqlzmvnnokfj.supabase.co/functions/v1/connect-return --project-ref ...`; deploy de `connect-onboarding` e de `connect-return` (`--no-verify-jwt`). Vincular a conta de teste ao negócio demo: `insert into merchant_accounts (business_id, provider, account_id) values (<id do negócio demo>, 'stripe', 'acct_1UXBoK3seq5yk1Fo')` via Management API, depois `action:'sync'`.

**Step 5: verificação manual:** com um lojista sem conta, `action:'link'` devolve URL que abre o formulário hospedado em test mode; após concluir, `account.updated` chega e `merchant_accounts.payouts_enabled = true`.

**Step 6: commit**
```bash
git add supabase/functions/_shared supabase/functions/connect-onboarding supabase/functions/connect-return __tests__/edge-connect.test.ts
```
```bash
git commit -m "feat(connect): merchant onboarding with account links"
```

## Task 8: `wallet-withdraw` (payout, transfer, reversal, fila manual)

**Files:**
- Create: `supabase/functions/_shared/withdrawPlan.ts` · `supabase/functions/wallet-withdraw/index.ts`
- Test: `__tests__/edge-withdraw-plan.test.ts`

**Step 1: testes que falham** (`planWithdraw({ source, amountCents, balanceCents, model, account, rules })`):
- Financeiro, modelo A, 10000 → passos `payout(9500)` + `reversal(500)`; ledger da Task 3;
- Financeiro, modelo B → `transfer(9500)` + `payout(9500)`;
- QI lojista → `transfer(net)` + `payout(net)`; abaixo de R$ 30,00 → `below_minimum` (regra do QI, `MIN_WITHDRAW_CENTS`);
- QI cliente → `manual_pending`, sem chamada Stripe;
- saldo insuficiente → `insufficient_balance`; conta sem `payouts_enabled` → `payout_account_inactive`.

**Step 2:** FAIL. **Step 3:** implementar. Handler recalcula a cotação no servidor (nunca confia na do app), saldo pelo ledger, grava `withdrawals` (`idempotency_key` vindo do app) + lançamentos, executa os passos com chaves `transfer:`/`payout:`/`reversal:{withdrawalId}`. Falha da Stripe depois do débito → `withdrawals.status = 'failed'` e estorno do lançamento na mesma função.

**Step 4 [USUÁRIO]:** deploy. **Step 5: verificação manual:** pagar um agendamento com `4000 0000 0000 0077`, sacar R$ 50,00 pelo `curl`: payout na conta conectada (Dashboard → conta conectada → Payouts), reversão de R$ 5,00 (modelo A), ledger `-5000`/`+500`; `payout.paid` marca `paid`.

**Step 6: commit**
```bash
git add supabase/functions/_shared supabase/functions/wallet-withdraw __tests__/edge-withdraw-plan.test.ts
```
```bash
git commit -m "feat(payments): withdrawals via payouts, transfers and manual queue"
```

## Task 9: SDK nativo da Stripe no app **[USUÁRIO para o rebuild]**

**Files:**
- Modify: `package.json` / `package-lock.json` (`npx expo install @stripe/stripe-react-native`) · `app.json` (plugin, só efeito em iOS/EAS) · `app.config.js` (`extra.stripePublishableKey`, `extra.paymentsProvider`) · `.env.example` · `app/_layout.tsx` (`StripeProvider`)
- Create: `lib/payments/stripeConfig.ts` · `__mocks__/@stripe/stripe-react-native.js`
- Test: `__tests__/stripe-config.test.ts`

**Step 1: testes que falham** (`stripeConfig`): sem env → `{ provider: 'mock' }`; `provider 'stripe'` sem publishable → cai para `mock` com `logger.warn`; chave começando com `sk_` ou `rk_` → lança (nunca aceitar secret no app); `pk_test_...` + `stripe` → `{ provider: 'stripe', publishableKey }`.

**Step 2:** FAIL. **Step 3:** implementar.
- `.env.example` ganha `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=` e `EXPO_PUBLIC_PAYMENTS_PROVIDER=mock`, e um bloco comentado com os nomes dos secrets das Edge Functions (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `PLATFORM_FEE_BPS`, `FURA_FILA_MAX_CENTS`, `CONNECT_RETURN_BASE_URL`, `DEMO_FURA_FILA_BUSINESS_ID`) com o aviso "NÃO preencher aqui: só em Supabase > Edge Functions > Secrets".
- `StripeProvider` envolve a árvore em `app/_layout.tsx` (`urlScheme="walltoall"`); com `provider 'mock'` renderiza os filhos sem provider.
- `__mocks__/@stripe/stripe-react-native.js`: `module.exports = require('@stripe/stripe-react-native/jest/mock.js')` (mesmo padrão de `__mocks__/react-native-maps.tsx`).
- Android: `android/` é versionado e não há prebuild (nota pós-implementação da F0); o módulo entra por autolinking. Conferir `minSdkVersion` >= 21 em `android/build.gradle` e tema `AppCompat` em `android/app/src/main/res/values/styles.xml`.

**Step 4:** verde + typecheck + suíte completa (marco: o mock global do SDK não pode quebrar suítes existentes).

**Step 5 [USUÁRIO]: rebuild do dev client.** Checar `Get-CimInstance Win32_OperatingSystem | Select-Object FreeVirtualMemory` (>= 6-8 GB livres; se baixo, fechar apps e `wsl --shutdown`); `npx expo run:android` com o Gradle limitado (`cd android; .\gradlew.bat assembleDebug --max-workers=2` se o run direto estourar memória); alternativa `eas build --profile development --platform android`. Smoke: app abre com `EXPO_PUBLIC_PAYMENTS_PROVIDER=mock` e tudo funciona como antes.

**Step 6: commit**
```bash
git add package.json package-lock.json app.json app.config.js .env.example app/_layout.tsx lib/payments/stripeConfig.ts __mocks__/@stripe __tests__/stripe-config.test.ts
```
```bash
git commit -m "chore(payments): add stripe react native sdk and provider config"
```

## Task 10: Contratos evoluídos + mocks [zona compartilhada]

**Files:**
- Modify (aditivo): `lib/services/types.ts` (`PaymentPurpose`, `PaymentRequestContext`, `PaymentStatus`, `PayoutAccountStatus`, campos opcionais em `PixCharge`, `context?` em `createPixCharge`/`payWithCard`, `paymentId?` no retorno, `getPaymentStatus`, `beginCardSetup`, `completeCardSetup`, `getPayoutAccountStatus`, `startPayoutOnboarding`) · `lib/services/mock/mockWalletService.ts` · `lib/services/bookingTypes.ts` (`cancelUnpaid`) · `lib/services/mock/mockBookingPaymentService.ts`
- Create: `lib/payments/awaitPaymentSettled.ts` · `lib/payments/checkoutKey.ts`
- Test: estender `__tests__/mock-wallet-service.test.ts` e `__tests__/mock-booking-payment-service.test.ts`; criar `__tests__/await-payment-settled.test.ts` e `__tests__/checkout-key.test.ts`

**Step 1: testes que falham.**
- Mock wallet: `createPixCharge(1500, 'x', ctx)` devolve `paymentId` e `qrImageUrl: null`; mesma `idempotencyKey` → mesmo `paymentId`; `getPaymentStatus` de Pix devolve `'succeeded'` por default e `'processing'` com a opção `{ pixAutoConfirm: false }`; `payWithCard` com contexto devolve `paymentId` e, repetido com a mesma chave depois de aprovado, não incrementa o contador `chargeCount` (exposto só no mock para teste); `beginCardSetup` → `seti_mock_..._secret_...`; `completeCardSetup` acrescenta um cartão de fixture; `getPayoutAccountStatus` → `'active'` (opção `payoutStatus`).
- Mock booking: `cancelUnpaid(id)` remove o registro não pago e é idempotente.
- `awaitPaymentSettled(getStatus, { intervalMs: 2000, timeoutMs: 60000 })` com fake timers: `processing, processing, succeeded` → `'succeeded'` em 3 chamadas; `failed` → `'failed'`; sem mudança → `'timeout'`; `signal` abortado para o polling.
- `newCheckoutKey()` gera chaves distintas e com prefixo `chk_`.

**Step 2:** FAIL. **Step 3:** implementar. `addCard` continua na interface nesta task (sai na Task 14, junto da tela).
**Step 4:** verde + typecheck. **Step 5: commit**
```bash
git add lib/services lib/payments __tests__/mock-wallet-service.test.ts __tests__/mock-booking-payment-service.test.ts __tests__/await-payment-settled.test.ts __tests__/checkout-key.test.ts
```
```bash
git commit -m "feat(payments): payment context, status and card setup in service contracts"
```

## Task 11: `StripeWalletService` + seleção no `ServicesContext` [zona compartilhada]

**Files:**
- Create: `lib/services/stripe/edgeClient.ts` (wrapper de `supabase.functions.invoke` com `PaymentsApiError` e códigos) · `lib/services/stripe/mappers.ts` · `lib/services/stripe/stripeWalletService.ts`
- Modify: `context/ServicesContext.tsx` (escolhe implementação por `getStripeConfig()`; mocks continuam default)
- Test: `__tests__/stripe-wallet-service.test.ts` · estender `__tests__/services-context.test.tsx`

**Step 1: testes que falham** (mock de `lib/supabase` + SDK mockado):
- `getCards` → `invoke('payments-cards', { method: 'GET' })` mapeado;
- `payWithCard` feliz: `invoke('payments-create-intent')` → `{ paymentId, status: 'processing' }`, polling lê `payments.status` → `succeeded` → `{ status: 'approved', paymentId }`;
- `requires_action` → `handleNextAction(clientSecret, 'walltoall://stripe-redirect')`; erro no 3DS → `'declined'`;
- resposta da função dizendo `succeeded` mas banco ainda `processing` → continua consultando (nunca aprova sem o banco);
- `failed` → `'declined'`; sem `context` → lança (a implementação real exige finalidade);
- `createPixCharge` → `PixCharge` com `copyPasteCode`, `qrCode` (mesmo payload), `qrImageUrl`, `expiresAt`, `paymentId`;
- `getPixKeys` → `from('my_pix_keys')`; `addPixKey` → `rpc('add_pix_key')`;
- `getStatement` → `payments` do pagador como `WalletEntry` negativos; `getMerchantBalanceCents` → `rpc('merchant_balance_cents')`; `getMerchantStatement` → `ledger_entries` mapeados para `service`/`fura_fila`/`withdraw` (taxa somada ao saque); `requestWithdraw` → `invoke('wallet-withdraw', { source: 'financeiro', amountCents, pixKeyId, idempotencyKey })`; `quoteWithdraw` local via `computeWithdrawQuote` (mesma régua do servidor, garantida pelo teste de paridade da Task 3);
- erros de código (`insufficient_balance`, `payout_account_inactive`, `amount_mismatch`) viram `Error` com mensagem pt-BR.
- `services-context`: sem config → `MockWalletService`; config `stripe` → `StripeWalletService` (mock de `lib/payments/stripeConfig`).

**Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde + suíte completa (marco) + typecheck.
**Step 5: commit**
```bash
git add lib/services/stripe context/ServicesContext.tsx __tests__/stripe-wallet-service.test.ts __tests__/services-context.test.tsx
```
```bash
git commit -m "feat(payments): stripe wallet service behind wallet interface"
```

## Task 12: Agendamento: reservar, depois cobrar (`StripeBookingPaymentService` + `confirm.tsx`)

**Files:**
- Create: `lib/services/stripe/stripeBookingPaymentService.ts`
- Modify: `lib/booking/createAppointment.ts` (opção `{ notify?: boolean }`, default `true`) · `app/(client)/schedule/confirm.tsx` · `context/ServicesContext.tsx` (`booking` Stripe)
- Test: `__tests__/stripe-booking-payment-service.test.ts` · estender `__tests__/booking-create-appointment.test.ts` e `__tests__/schedule-confirm.test.tsx`

**Step 1: testes que falham.**
- Serviço: `getPayment(77)` lê `payments` (`purpose booking`) → `succeeded` cartão vira `{ status: 'paid', method: 'card', cardLast4, cardBrand, paidAt }`; `pay_on_site` vira `pay_on_site`; outras situações → `null`; `recordPayment(77, paid)` com banco não `succeeded` → lança; `recordPayment(77, pay_on_site)` → `rpc('record_pay_on_site')`; `cancelUnpaid(77)` → `invoke('payments-cancel')`.
- `createAppointment(draft, { notify: false })` não chama `notifyAppointmentRequested`.
- Tela: **cartão aprovado** → `createAppointment` chamado antes de `payWithCard` (`mock.invocationCallOrder`), com `notify: false`; `payWithCard` recebe `{ purpose: { kind: 'booking', appointmentId: 77 }, idempotencyKey: 'booking:77' }`; `notifyAppointmentRequested` depois da aprovação; modal. **Recusado e nova tentativa** com outro cartão → `createAppointment` uma única vez, `payWithCard` duas vezes com a mesma chave. **Voltar após recusa** → `booking.cancelUnpaid(77)`. **Falha do `createAppointment`** → `payWithCard` nunca chamado. **Pix** → reserva, sheet com o contexto; fechar sem pagar → `cancelUnpaid(77)`. **Pagar na hora** inalterado (notificação no `createAppointment`).

**Step 2:** FAIL. **Step 3:** implementar o fluxo do design § 7 (estado `reservedAppointmentId` na tela; efeito de saída chama `cancelUnpaid` se reservado e não pago).
**Step 4:** verde + typecheck.
**Step 5: commit**
```bash
git add lib/services/stripe/stripeBookingPaymentService.ts lib/booking/createAppointment.ts "app/(client)/schedule/confirm.tsx" context/ServicesContext.tsx __tests__/stripe-booking-payment-service.test.ts __tests__/booking-create-appointment.test.ts __tests__/schedule-confirm.test.tsx
```
```bash
git commit -m "feat(schedule): reserve then charge with stripe booking payments"
```

## Task 13: Pix confirmado pelo servidor + fura-fila sem re-cobrança [zona compartilhada]

**Files:**
- Modify: `components/payment/PaymentPixBottomSheet.tsx` (prop `context?`; `Image` com `qrImageUrl`, placeholder atual como fallback; polling enquanto aberto; "Já realizei o pagamento" força consulta; usa `PaymentProcessingSheet` no lugar do estado próprio) · `components/payment/PaymentCardBottomSheet.tsx` (prop `context?` repassada; `onSuccess(paymentId?)`) · `app/(client)/aqui-agora/fura-fila.tsx` (chave por tentativa com `newCheckoutKey()`; guarda `paidPaymentId`; falha do `joinQueue` mostra "Tentar entrar na fila", que só repete o `joinQueue`; atualiza o comentário das linhas 116-121)
- Test: estender `__tests__/payment-bottom-sheets.test.tsx` e `__tests__/aqui-agora-fura-fila.test.tsx`

**Step 1: testes que falham.**
- Pix sheet: com `qrImageUrl` renderiza `testID="pix-qr-image"`; sem, o placeholder; `context` repassado a `createPixCharge`; status `processing` → `succeeded` (fake timers) chama `onSuccess` uma vez; "Já realizei o pagamento" com status `processing` mostra "Ainda não identificamos o pagamento" e não chama `onSuccess`; fechar para o polling.
- Card sheet: `context` chega ao `payWithCard`.
- Fura-fila: cartão aprovado + `joinQueue` rejeitando uma vez → "Tentar entrar na fila" → `payWithCard` chamado **uma** vez e `joinQueue` duas; as cobranças da mesma tentativa usam a mesma `idempotencyKey` com `purpose { kind: 'fura_fila', merchantRef: 'm1' }`.

**Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde + suíte completa (marco: componentes compartilhados da F1/F5) + typecheck.
**Step 5: commit**
```bash
git add components/payment/PaymentPixBottomSheet.tsx components/payment/PaymentCardBottomSheet.tsx "app/(client)/aqui-agora/fura-fila.tsx" __tests__/payment-bottom-sheets.test.tsx __tests__/aqui-agora-fura-fila.test.tsx
```
```bash
git commit -m "feat(payment): pix confirmed from server status; fura-fila retry without recharge"
```

## Task 14: Cadastro de cartão com `CardField` + SetupIntent

**Files:**
- Modify: `app/(client)/wallet/new-card.tsx` · `lib/services/types.ts` (remove `addCard` da interface; não aditivo, ver design § 4) · `lib/services/mock/mockWalletService.ts` (`addCard` vira método só da classe) · `lib/services/stripe/stripeWalletService.ts` (`beginCardSetup`/`completeCardSetup`)
- Test: reescrever `__tests__/client-new-card.test.tsx`; ajustar quem chamava `addCard` pela interface (`grep -rn "addCard" app components __tests__`)

**Step 0:** `get_design_context` nodeId `2660:6604`. Estilizar o `CardField` com `cardStyle` a partir dos tokens (`borderColor`, `textColor`, `placeholderColor`, `borderRadius`, `fontSize`); rótulos pt-BR acima do campo; preview `CreditCard` alimentado por `onCardChange` (`last4`, `brand`, validade).

**Step 1: testes que falham** (SDK mockado: `CardField` com `testID`, `confirmSetupIntent` `jest.fn`): CTA desabilitado até nome preenchido **e** `onCardChange({ complete: true })`; enviar → `beginCardSetup` → `confirmSetupIntent(secret, { paymentMethodType: 'Card', paymentMethodData: { billingDetails: { name } } })` → `completeCardSetup(setupIntent.id)` → toast "Cartão adicionado" + `router.back()`; erro do `confirmSetupIntent` → toast pt-BR ("Cartão recusado" para `card_declined`, genérico nos demais); duplo toque não dispara dois setups; nenhum número de cartão chega ao `WalletService`.

**Step 2:** FAIL. **Step 3:** implementar. Registrar a divergência do Figma no commit e na tabela de divergências do PR.
**Step 4:** verde + typecheck.
**Step 5: commit**
```bash
git add "app/(client)/wallet/new-card.tsx" lib/services __tests__/client-new-card.test.tsx
```
```bash
git commit -m "feat(wallet): add card through stripe card field and setup intent"
```

## Task 15: Financeiro do lojista: onboarding e saque resiliente

**Files:**
- Create: `components/wallet/PayoutOnboardingBanner.tsx`
- Modify: `app/(merchant)/financeiro/index.tsx` (banner quando `getPayoutAccountStatus() !== 'active'`) · `app/(merchant)/financeiro/withdraw.tsx` (`catch` na carga com erro + "Tentar novamente" + "Voltar", fecha o débito F3; estado bloqueado com o CTA de ativação quando a conta não está ativa) · `lib/services/stripe/stripeWalletService.ts` (`getPayoutAccountStatus`, `startPayoutOnboarding` via `connect-onboarding`)
- Test: `__tests__/payout-onboarding-banner.test.tsx` · estender `__tests__/merchant-financeiro.test.tsx` e `__tests__/merchant-withdraw.test.tsx`

**Step 0:** sem node no Figma para o banner: seguir o padrão visual de aviso do app (tokens existentes, card claro com ícone e CTA outline navy). Divergência registrada.

**Step 1: testes que falham** (`jest.mock('expo-web-browser')`): `active` → banner ausente; `pending`/`none` → "Ative seus recebimentos" e CTA "Ativar recebimentos" → `startPayoutOnboarding()` → `WebBrowser.openAuthSessionAsync(url, 'walltoall://financeiro')` → recarrega o status; saque com carga falhando → mensagem de erro, "Tentar novamente" recarrega, "Voltar" presente (sem spinner infinito); saque com conta inativa → formulário bloqueado e CTA de ativação.

**Step 2:** FAIL. **Step 3:** implementar (carga no mesmo idioma do `QiWithdrawScreen`). **Step 4:** verde + suíte completa (marco) + typecheck.
**Step 5: commit**
```bash
git add components/wallet/PayoutOnboardingBanner.tsx "app/(merchant)/financeiro/index.tsx" "app/(merchant)/financeiro/withdraw.tsx" lib/services/stripe/stripeWalletService.ts __tests__/payout-onboarding-banner.test.tsx __tests__/merchant-financeiro.test.tsx __tests__/merchant-withdraw.test.tsx
```
```bash
git commit -m "feat(financeiro): payout onboarding banner and resilient withdraw load"
```

## Task 16: QI: cashback no ledger e saques (implementação híbrida)

Depende das decisões C e Q (design § 13). Pode ser pulada no piloto sem afetar as outras tasks; nesse caso o QI segue 100% mock.

**Files:**
- Create: `lib/services/stripe/stripeQiService.ts` (delega `getQiCode`, `listIndicacoes`, `getIndicacao`, `getIndicacaoStatement`, `getProgramRules` ao `MockQiService`; `getQiSummary` sobrepõe `balanceCents` com `my_qi_balance_cents`/`merchant_balance_cents(..., 'merchant_qi')`; `requestQiWithdraw` → `wallet-withdraw` com `source` `qi_client`/`qi_merchant`)
- Modify: `supabase/functions/_shared/ledger.ts` (`entriesForCashback`) · `supabase/functions/stripe-webhook/index.ts` (acúmulo no `succeeded` quando o pagador tem `profiles.referred_by`) · `context/ServicesContext.tsx` (`qi` Stripe)
- Test: `__tests__/stripe-qi-service.test.ts` · estender `__tests__/edge-ledger.test.ts`

**Step 1: testes que falham:** `entriesForCashback(payment 6500, perServicePct 10)` → `client_qi +650 qi_cashback` para o indicador (ou `merchant_qi` se o indicador for lojista); sem indicador → nada; `StripeQiService.getQiSummary('client').balanceCents` vem do RPC e o resto do mock; `requestQiWithdraw('client', 3000, key)` → `wallet-withdraw` `qi_client`; abaixo do mínimo → erro antes da chamada.
**Step 2:** FAIL. **Step 3:** implementar. **Step 4 [USUÁRIO]:** redeploy do `stripe-webhook`; SQL de demo preenchendo `profiles.referred_by` do cliente demo.
**Step 5:** verde + typecheck + commit
```bash
git add lib/services/stripe/stripeQiService.ts supabase/functions/_shared/ledger.ts supabase/functions/stripe-webhook context/ServicesContext.tsx __tests__/stripe-qi-service.test.ts __tests__/edge-ledger.test.ts
```
```bash
git commit -m "feat(qi): cashback ledger and withdrawals behind qi service"
```

## Task 17 (opcional, depende da F7): Assinatura do lojista com Stripe Billing (só cartão)

**Pré-condição:** F7 mergeada com o `SubscriptionService` (interface e mock) e as telas `subscription-offer` `2678:150` / `subscription-manage` `2680:177`. Sem isso, pular. Pix fica de fora: a Stripe não suporta Pix recorrente.

**Files:**
- Create: `supabase/migrations/<timestamp>_f8_subscriptions.sql` (`subscriptions`: `business_id`, `provider_subscription_id`, `status`, `current_period_end`, `price_id`, RLS do dono) · `supabase/functions/_shared/subscriptionStatus.ts` · `supabase/functions/subscriptions/index.ts` · `lib/services/stripe/stripeSubscriptionService.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts` (`customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`) · `context/ServicesContext.tsx`
- Test: `__tests__/edge-subscription-status.test.ts` · `__tests__/stripe-subscription-service.test.ts`

**Step 1 [USUÁRIO]:** criar Product e Price recorrente em test mode (valor = decisão S) e `npx supabase secrets set STRIPE_SUBSCRIPTION_PRICE_ID=price_... --project-ref ...`; adicionar os eventos de assinatura ao endpoint "Your account".
**Step 2: testes que falham:** mapa de status Stripe → domínio da F7 (`active`, `past_due`, `canceled`, `incomplete`); serviço assina com o cartão default (`payment_settings.payment_method_types: ['card']`, `payment_behavior: 'default_incomplete'`), confirma o PI da primeira fatura com `handleNextAction` quando houver 3DS; cancelamento no fim do período.
**Step 3:** FAIL → implementar → verde. **Step 4:** demo de renovação com **test clock** da Stripe (avançar 1 mês e ver `invoice.paid`).
**Step 5: commit**
```bash
git add supabase/migrations supabase/functions/_shared/subscriptionStatus.ts supabase/functions/subscriptions supabase/functions/stripe-webhook lib/services/stripe/stripeSubscriptionService.ts context/ServicesContext.tsx __tests__/edge-subscription-status.test.ts __tests__/stripe-subscription-service.test.ts
```
```bash
git commit -m "feat(subscription): stripe billing for merchant subscription, card only"
```

## Task 18: QA em dispositivo e roteiro da demo ao cliente **[USUÁRIO]**

**Preparação:** `.env` local com `EXPO_PUBLIC_PAYMENTS_PROVIDER=stripe`; dev client da Task 9; funções e webhooks no ar; dados de demo: cliente demo (com `referred_by` se a Task 16 entrou), negócio demo vinculado a `acct_1UXBoK3seq5yk1Fo` com um serviço de R$ 65,00, um lojista sem conta para o onboarding; Dashboard da Stripe aberto no computador ao lado (Payments, Connected accounts, Webhooks).

**Roteiro (cerca de 15 min, cliente vendo celular e dashboard):**
1. **Cartão salvo:** Carteira → Adicionar cartão → `4242 4242 4242 4242` → cartão na pilha. No dashboard: Customer com o cartão.
2. **3DS:** adicionar `4000 0025 0000 3155` → desafio de autenticação → aprovar → cartão na pilha.
3. **Agendamento com cartão:** loja → serviço → horário → Confirmar → cartão 4242 → "Processando seu pagamento..." → "Agendamento concluído" → lista. Dashboard: PaymentIntent `succeeded` com transferência para a conta conectada e taxa da plataforma. Detalhe do agendamento: "Pago com cartão •••• 4242".
4. **Recusa e nova tentativa:** adicionar `4000 0000 0000 0002`, pagar outro agendamento com ele → "Pagamento recusado" → Alterar para 4242 → aprovado. Dashboard: **um** PaymentIntent com a tentativa recusada e a aprovada (sem cobrança dupla).
5. **Agendamento com Pix:** QR real e copia e cola no sheet → no computador, abrir o `hosted_instructions_url` do PI e simular a leitura → o celular sai sozinho para "Agendamento concluído" (a confirmação veio do webhook, não do clique).
6. **Pagar na hora:** Dinheiro → "Pagar na hora" → detalhe "Pagar na hora (Dinheiro)".
7. **Fura-fila:** perfil do lojista no Aqui e Agora → Furar fila → Pix ou cartão → senha. Com `DEMO_FURA_FILA_BUSINESS_ID` definido, o Financeiro do lojista demo mostra "Furou Fila".
8. **Financeiro do lojista demo:** saldo = soma dos créditos; conferir com o saldo da conta conectada no dashboard. Sacar R$ 50,00 → resumo com taxa R$ 5,00 → concluído. Dashboard: payout na conta conectada (e a reversão da taxa, no modelo A).
9. **Onboarding:** entrar como lojista sem conta → banner "Ative seus recebimentos" → formulário hospedado da Stripe (dados de teste) → volta ao app → banner some.
10. **(Opcional) Estorno:** estornar pelo dashboard o pagamento do passo 3 → detalhe e extrato refletem.
11. **(Se Task 16) QI:** cashback do agendamento do cliente indicado aparece no saldo do QI; saque QI do lojista.

**Checagens técnicas depois do roteiro:** "Resend" de um `payment_intent.succeeded` no dashboard não duplica `ledger_entries`; `select count(*) from stripe_events where processed_at is null` = 0; conciliação `merchant_balance_cents(<negócio demo>, 'merchant')` x saldo da conta conectada; nenhum agendamento `pending` sem pagamento com mais de 30 min. Anotar resultados e screenshots para o PR.

## Task 19: Verificação final, rebase e PR

1. `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` → 0 erros. `npm run lint` → nenhum problema novo. `npx jest --maxWorkers=2` → tudo verde (a baseline dos pré-requisitos só cresce).
2. Segredos: `git grep -nE "sk_(test|live)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|rk_(test|live)_[A-Za-z0-9]{8,}"` → zero resultados. `git diff origin/main --stat` sem `.env`.
3. Travessão (U+2014): `git grep -nP "\x{2014}" -- docs/plans/2026-11-02-f8-* supabase lib app components __tests__` → zero resultados nos arquivos tocados pela fase (corrigir qualquer ocorrência).
4. **Rebase na main:** `git fetch origin` → `git rebase origin/main`. Conflitos esperados em `lib/services/types.ts`, `context/ServicesContext.tsx`, `__tests__/test-utils.tsx`, `components/payment/*` (se F6/F7 entraram antes): manter as duas adições, nunca descartar a da outra fase. Typecheck + suíte de novo depois do rebase.
5. `git push -u origin feat/f8-pagamentos-stripe` e abrir o PR (`gh pr create`, **sem rodapé de AI**) com: resumo; resultado do spike (modelo de fundos escolhido por método); tabela fluxo x objeto Stripe; secrets e endpoints que precisam existir (só nomes); passos de deploy; divergências do Figma (cadastro de cartão com `CardField`, banner de onboarding, "Ainda não identificamos o pagamento", "Tentar entrar na fila"); decisões de negócio em aberto (design § 13); dívidas fechadas e restantes (design § 15); resultado do QA da Task 18.
6. **Depois do merge, na main:** atualizar o doc mestre (§ Fase 8: recorte pagamentos implementado em test mode; linha na § 7). Não fazer isso nesta branch.

**Commits:** um por task (mensagens acima); `docs: f8 stripe payments design and plan` já no início da branch.
