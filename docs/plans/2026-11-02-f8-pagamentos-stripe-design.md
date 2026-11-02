# F8: Integração real de pagamentos com Stripe (test mode). Design

**Data:** 2026-11-02
**Fase:** 8 do novo escopo (`docs/plans/2026-07-06-novo-escopo-master.md`, § Fase 8, § 4, § 6), recorte **pagamentos**
**Branch:** `feat/f8-pagamentos-stripe` (worktree `.worktrees/f8-pagamentos-stripe`)
**Pré-requisito de execução:** F5 (`feat/f5-agendamento`) mergeada na `main`. Este doc já considera o `BookingPaymentService` e os componentes `components/payment/*` da F5 (lidos no worktree `.worktrees/f5-agendamento`, commit `b072244`).
**Stripe:** sandbox "Área restrita de Wall to All", conta `acct_1UX9o33seqKLeNs2`, Connect como **marketplace**, conta conectada de teste `acct_1UXBoK3seq5yk1Fo` (Brasil).

O app chega à F8 com todo dinheiro passando por mocks (`MockWalletService`, `MockQiService`, `MockBookingPaymentService`). Este recorte troca o dinheiro de mentira por cobranças reais da Stripe em **test mode**, para o piloto e a demonstração ao cliente, sem tocar no que não é pagamento. Vídeo, mapas e fila em tempo real ficam fora (outros recortes da F8).

---

## 1. Contexto e decisões

| # | Decisão | Escolha |
|---|---|---|
| 1 | PSP do piloto | **Stripe em test mode** para o piloto e a demo. O PSP de produção é decidido depois (a pesquisa recomendou Asaas). Por isso o código específico da Stripe fica confinado às Edge Functions e a `lib/services/stripe/*`, e o schema usa nomes neutros (`provider`, `provider_payment_id`) para a troca futura não exigir migration destrutiva. |
| 2 | Fronteira no app | Pagamentos continuam **atrás das interfaces de serviço existentes** (`WalletService`, `QiService` em `lib/services/types.ts`; `BookingPaymentService` em `lib/services/bookingTypes.ts`). Nascem implementações Stripe ao lado dos mocks (`lib/services/stripe/`); os mocks ficam para o jest; a troca acontece no `context/ServicesContext.tsx`. |
| 3 | Conta Stripe | Sandbox `acct_1UX9o33seqKLeNs2`, Connect **marketplace** (a plataforma cobra do cliente e repassa a lojistas/recebedores). Conta conectada de teste `acct_1UXBoK3seq5yk1Fo` (BR). Métodos habilitados: cartão, Apple Pay, Google Pay, Link, Pix. Boleto desligado. |
| 4 | Chaves | `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` já está no `.env` local (gitignored). A **secret key ainda não existe**: o usuário cria no dashboard (Task 1). Ela vai **somente** para os secrets das Edge Functions do Supabase (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e, ver § 6, `STRIPE_CONNECT_WEBHOOK_SECRET`). Nunca no app, nunca no repo. `.env.example` recebe só os nomes. |
| 5 | Onde roda o código com secret | **Supabase Edge Functions (Deno)**. O app usa `@stripe/stripe-react-native` (dependência nativa nova: config plugin do Expo + rebuild do dev client). |
| 6 | Fonte da verdade do pagamento | **Webhook da Stripe** grava no Postgres. O app nunca confia só no sucesso do lado do cliente: "aprovado" na UI significa "a linha em `payments` está `succeeded`", lida do banco. |
| 7 | Valores de negócio | Taxa da plataforma, preço do fura-fila, % de cashback e taxa de saque **não estão decididos**. A F8 usa os valores que já estão nos mocks/fixtures e os lista como decisões abertas (§ 13). |
| 8 | Escopo | Só pagamentos. Assinatura (F7, Stripe Billing, só cartão porque Pix recorrente não é suportado) entra como **última task opcional**, dependente da UI da F7. |
| 9 | Incerteza Pix + Connect | Não está confirmado que Pix funciona com Connect (destination charge ou separate charges and transfers) numa plataforma brasileira. A Task 1 do plano é um **spike** na API de teste. Fallback se falhar: o Pix cai na conta da plataforma, a parte do lojista é registrada no ledger e movida depois com um `transfer` separado (§ 3.2). |
| 10 | Ordem na confirmação do agendamento | **Reservar, depois cobrar** (inverte a decisão #3 da F5, como a própria F5 previu na § 9 dela): o agendamento é criado `pending`, a cobrança é feita com referência a ele, e o webhook confirma. Detalhe na § 7. |

## 2. Mapa: cada fluxo de dinheiro do app x objeto Stripe

Levantado com grep nos chamadores de `WalletService`/`QiService`/`BookingPaymentService` (`app/`, `components/`, F5 no worktree dela).

| # | Fluxo | Onde no app | Hoje (mock) | Primitiva Stripe | Observações |
|---|---|---|---|---|---|
| 1 | Listar cartões salvos | `app/(client)/wallet/index.tsx:55`, `app/(client)/aqui-agora/fura-fila.tsx:74`, `components/payment/PaymentCardBottomSheet.tsx:58`, F5 `schedule/confirm.tsx` | `getCards()` | **Customer** + `GET /v1/customers/{id}/payment_methods?type=card`; default em `invoice_settings.default_payment_method` | `PaymentCard.id` passa a ser o `pm_...`. Um Customer por usuário (`psp_customers`). |
| 2 | Adicionar cartão | `app/(client)/wallet/new-card.tsx:169` | `addCard({ number, holderName, expiry, cvv })` | **SetupIntent** (`usage=on_session`) + `CardField` do SDK + `confirmSetupIntent` | O número cru **não pode** passar pelo nosso código (PCI). Muda o contrato e a tela (§ 8.4, divergência do Figma `2660:6604`). |
| 3 | Fura-fila com cartão | `fura-fila.tsx` → `PaymentCardBottomSheet.tsx:90` | `payWithCard(cardId, amount, desc)` | **PaymentIntent** (`customer`, `payment_method`, `confirm=true`), 3DS via `handleNextAction` | Lojista da fila é fixture (`m1`...), sem conta conectada: cobrança **na plataforma** + ledger (§ 3.3). |
| 4 | Fura-fila com Pix | `fura-fila.tsx` → `PaymentPixBottomSheet.tsx:135` | `createPixCharge(amount, desc)` + clique em "Já realizei o pagamento" | **PaymentIntent** `payment_method_types=[pix]`, `confirm=true`; `next_action.pix_display_qr_code` (`data`, `image_url_png`, `expires_at`, `hosted_instructions_url`) | O clique deixa de confirmar: o sheet consulta o status (§ 8.3). QR real vem do `image_url_png` (hoje é placeholder desenhado). |
| 5 | Agendamento com cartão | F5 `schedule/confirm.tsx` (`payWithCard`) | `payWithCard` + `recordPayment` | **PaymentIntent destination charge**: `transfer_data[destination]=acct_lojista`, `application_fee_amount=taxa` | Valor calculado no servidor a partir de `services.price`. Um PI por agendamento. |
| 6 | Agendamento com Pix | F5 `confirm.tsx` → `PaymentPixBottomSheet` | `createPixCharge` + `recordPayment` | PaymentIntent Pix como destination charge **se o spike aprovar**; senão cobrança na plataforma + `transfer` | § 3.2. |
| 7 | Pagar na hora | F5 `confirm.tsx` (`pay_on_site`) | `recordPayment({ status: 'pay_on_site' })` | Nenhuma | Linha em `payments` com `status = 'pay_on_site'`, sem PSP. |
| 8 | Chaves Pix | `components/wallet/PixKeyForm.tsx:231`, `PixKeySection` | `addPixKey` / `getPixKeys` | Nenhuma | Persistência própria (`pix_keys`). A Stripe **não paga para chave Pix** (§ 3.4). |
| 9 | Extrato do cliente | `app/(client)/wallet/index.tsx:57` | `getStatement()` (vazio) | Nenhuma (leitura de `payments` do pagador) | Débitos `service`/`fura_fila`. |
| 10 | Saldo e extrato do lojista | `app/(merchant)/financeiro/index.tsx:128` | `getMerchantBalanceCents` / `getMerchantStatement` | Ledger próprio, conciliado com o **Balance** da conta conectada | O app sempre exibe o ledger. |
| 11 | Saque do lojista | `app/(merchant)/financeiro/withdraw.tsx:96` (`WithdrawFlow`) | `quoteWithdraw` / `requestWithdraw(amount, pixKeyId)` | **Payout** na conta conectada (`Stripe-Account`), agenda manual; taxa via **transfer reversal** parcial (modelo A) ou **Transfer** líquido + payout (modelo B) | § 3.4. |
| 12 | Onboarding do lojista | novo (banner no Financeiro) | inexistente | **Accounts** (`country=BR`, capability `transfers`) + **Account Links** (`account_onboarding`) | § 9. |
| 13 | Cashback QI (acúmulo) | QI cliente/lojista (`components/qi/*`) | fixtures (`qiFixtures.ts`) | Nenhuma (ledger, custo da plataforma) | Depende de vínculo de indicação (§ 13, decisão Q). |
| 14 | Saque QI do lojista | `app/(merchant)/qi/withdraw.tsx` → `QiWithdrawScreen.tsx:214` | `requestQiWithdraw('merchant', ...)` | **Transfer** plataforma → conta conectada + **Payout** | Dinheiro sai do saldo da plataforma. |
| 15 | Saque QI do cliente | `app/(client)/qi/withdraw.tsx` → `QiWithdrawScreen.tsx:214` | `requestQiWithdraw('client', ...)` | **Nenhuma sem onboarding do cliente no Connect** | Piloto: pedido registrado como `manual_pending` (§ 3.4, decisão aberta). |
| 16 | Assinatura do lojista | F7 (UI ainda não existe) | `SubscriptionService` (F7) | **Billing**: Product/Price, Subscription com cartão salvo, Invoice | Só cartão. Task opcional. |
| 17 | Estorno | sem UI | inexistente | **Refund** (`reverse_transfer=true`, `refund_application_fee=true`) | Piloto: estorno manual pelo dashboard; o webhook atualiza `payments` e ledger. Política é decisão aberta. |
| 18 | "Adicionar saldo" | **não existe no app** | n/a | n/a | A carteira do cliente só tem cartões, chaves Pix e extrato (`wallet/index.tsx`). Nenhum fluxo de recarga para mapear. |

Apple Pay, Google Pay e Link estão habilitados no sandbox, mas nenhum fluxo do Figma os usa (o app tem UI própria de cartão salvo). Ficam fora do piloto; o `PlatformPayButton` do SDK é o caminho quando entrarem (Apple Pay exige merchant identifier e certificado).

## 3. Modelo de fundos

### 3.1 Modelo-alvo (A): destination charge

Agendamento pago online, lojista com conta conectada ativa: `PaymentIntent` na plataforma com `transfer_data[destination]` e `application_fee_amount`. A Stripe transfere `valor - taxa` para a conta conectada no ato. O ledger credita o lojista com o mesmo líquido, então **ledger = saldo da conta conectada** (conciliável).

### 3.2 Fallback (B): cobrança na plataforma + transfer separado

Usado quando: (a) o spike mostrar que Pix não aceita `transfer_data` (ou o Connect BR não permitir destination charge para Pix); (b) o recebedor não tem conta conectada utilizável (fura-fila com lojista fixture, lojista sem onboarding). O dinheiro fica na plataforma (`funds_flow = 'platform'`), o ledger credita o lojista e o `transfer` acontece no saque (ou num repasse em lote). O spike também confirma se `transfers` (com e sem `source_transaction`) funciona no BR para este tipo de conta.

A coluna `payments.funds_flow` registra qual modelo cada cobrança usou; a Edge Function decide por regra explícita (`_shared/fundsFlow.ts`, função pura e testada), alimentada pelo resultado do spike.

### 3.3 Fura-fila

A fila ainda é mock (`lib/services/mock/queueFixtures.ts`, merchants `m1` a `m6`), e fila real está fora deste recorte. Consequências:

- Não há `business_profiles.id` nem conta conectada por trás de `m1`: a cobrança é sempre `funds_flow = 'platform'`, com `merchant_ref = 'm1'` no `payments`.
- O valor não pode ser calculado no servidor (o preço mora na fixture). O servidor valida faixa (`> 0` e `<= FURA_FILA_MAX_CENTS`) e registra o risco (§ 14). Some quando a fila tiver backend.
- Para a demo, o secret opcional `DEMO_FURA_FILA_BUSINESS_ID` (só test mode) faz o webhook creditar a parte do lojista no ledger daquele negócio, para o Financeiro mostrar "Furou Fila".
- Hoje a tela cobra `SERVICE_BASE_CENTS` (R$ 80,00, "decorativo") **mais** a taxa (`fura-fila.tsx:33` e `:88`). Cobrar R$ 80,00 de verdade por um serviço que a fila não modela é decisão aberta (§ 13, decisão F).

### 3.4 Saques

- **Lojista (Financeiro), modelo A:** o saldo está na conta conectada. Saque = `Payout` de `totalCents` (líquido da cotação) com header `Stripe-Account`, e a taxa (`feeCents`) volta para a plataforma por **reversão parcial** de um transfer anterior (`POST /v1/transfers/{id}/reversals`). Não há primitiva de "cobrar taxa no payout" no BR; a reversão é o mecanismo do piloto e o spike a valida. Agenda de payout manual (`settings.payouts.schedule.interval=manual`) para o saldo só sair quando o lojista pede.
- **Lojista, modelo B:** `Transfer` de `totalCents` da plataforma para a conta conectada, depois `Payout`. A taxa simplesmente não é transferida.
- **QI do lojista:** sempre B (o cashback é dinheiro da plataforma).
- **QI do cliente:** cliente não é conta conectada. Sem onboarding Connect do cliente (KYC) não há primitiva Stripe para pagar a ele. Piloto: o pedido vira `withdrawals.status = 'manual_pending'` e o ledger debita; a operação paga por fora. Decisão aberta (§ 13, decisão Q).
- **Chave Pix no saque:** a Stripe paga na **conta bancária** cadastrada no onboarding, não numa chave Pix. O `WithdrawFlow` continua pedindo a chave (UI inalterada), mas na implementação Stripe ela vira só rótulo do pedido; o destino real é a conta externa da conta conectada. Decisão aberta (§ 13, decisão P).
- **Saldo disponível:** em test mode, cobranças com `4000 0000 0000 0077` (ou `pm_card_bypassPending`) ficam disponíveis na hora, o que permite demonstrar saque no mesmo dia.

## 4. Contratos no app (evolução das interfaces)

Mudanças **aditivas** onde possível; as não aditivas estão marcadas.

```ts
// lib/services/types.ts (acréscimos)
export type PaymentPurpose =
  | { kind: 'booking'; appointmentId: number }
  | { kind: 'fura_fila'; merchantRef: string };

export interface PaymentRequestContext {
  purpose: PaymentPurpose;
  /** UUID por tentativa de checkout (fura-fila) ou `booking:{id}`. Mesma chave = mesma cobrança. */
  idempotencyKey: string;
}

export type PaymentStatus =
  | 'requires_payment' | 'requires_action' | 'processing'
  | 'succeeded' | 'failed' | 'canceled' | 'refunded';

export interface PixCharge {
  // campos atuais mantidos (qrCode, copyPasteCode, amountCents, expiresAt)
  /** Id da linha em `payments` (Stripe) ou id fake (mock). */
  paymentId?: string;
  /** PNG do QR gerado pela Stripe; null no mock (a UI cai no placeholder atual). */
  qrImageUrl?: string | null;
}

export interface WalletService {
  // assinaturas atuais + parâmetro opcional:
  createPixCharge(amountCents: number, description: string, context?: PaymentRequestContext): Promise<PixCharge>;
  payWithCard(cardId: string, amountCents: number, description: string, context?: PaymentRequestContext):
    Promise<{ status: 'approved' | 'declined'; paymentId?: string }>;
  // novos:
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  beginCardSetup(): Promise<{ setupIntentClientSecret: string }>;
  completeCardSetup(setupIntentId: string): Promise<PaymentCard>;
  /** Lojista: estado da conta de recebimento ('active' | 'pending' | 'none'). Mock: 'active'. */
  getPayoutAccountStatus(): Promise<PayoutAccountStatus>;
  /** Lojista: URL do Account Link de onboarding (§ 9). */
  startPayoutOnboarding(): Promise<{ url: string }>;
  // NÃO aditivo: addCard(raw) sai da interface (fica só no MockWalletService como helper de fixture).
}
```

Semântica de `payWithCard` na implementação Stripe: chama `payments-create-intent`; se vier `requires_action`, roda `handleNextAction(clientSecret)` do SDK (3DS); depois espera o status do banco (`awaitPaymentSettled`, § 8.3). Só devolve `'approved'` quando `payments.status = 'succeeded'`. Assim `PaymentCardBottomSheet` e a confirmação da F5 mantêm o contrato "approved = pago de verdade".

```ts
// lib/services/bookingTypes.ts (acréscimo)
export interface BookingPaymentService {
  recordPayment(...): Promise<BookingPayment>;   // Stripe: grava só 'pay_on_site'; para 'paid' LÊ o banco e lança se não estiver succeeded
  getPayment(appointmentId: number): Promise<BookingPayment | null>; // Stripe: lê `payments`
  /** Novo: cancela o PI pendente e libera o horário (status 'canceled'). Idempotente. */
  cancelUnpaid(appointmentId: number): Promise<void>;
}
```

`QiService` não muda de forma; a implementação Stripe é **híbrida** (Task 16 do plano): saldo e saque vêm do ledger, listas de indicações continuam do mock até existir backend de indicação.

## 5. Novas tabelas (migration `supabase/migrations/20261102120000_f8_payments.sql`)

Todas com RLS ligada. Escrita **só pelo service role** (Edge Functions); o app só lê o que é dele. Valores em centavos (`integer`), moeda `brl`.

| Tabela | Colunas principais | RLS (select) |
|---|---|---|
| `psp_customers` | `user_id uuid pk → auth.users`, `provider text default 'stripe'`, `customer_id text unique`, `created_at` | `user_id = auth.uid()` |
| `merchant_accounts` | `business_id bigint pk → business_profiles`, `provider`, `account_id text unique`, `charges_enabled`, `payouts_enabled`, `details_submitted bool`, `requirements_due jsonb`, `updated_at` | dono do negócio (`business_profiles.owner_id = auth.uid()`) |
| `payments` | `id uuid pk`, `payer_id uuid`, `purpose payment_purpose` (`booking`/`fura_fila`/`subscription`), `appointment_id bigint null → appointments`, `merchant_business_id bigint null`, `merchant_ref text null`, `method payment_method` (enum existente pix/card/cash), `status payment_status` (`requires_payment`/`requires_action`/`processing`/`succeeded`/`failed`/`canceled`/`refunded`/`pay_on_site`), `amount_cents int check > 0`, `platform_fee_cents int default 0`, `funds_flow` (`destination`/`platform`/`none`), `provider`, `provider_payment_id text unique`, `idempotency_key text unique not null`, `card_last4`, `card_brand`, `failure_code`, `paid_at`, `created_at`, `updated_at` | pagador **ou** dono do negócio do `merchant_business_id` |
| `ledger_entries` | `id bigserial`, `account ledger_account` (`merchant`/`merchant_qi`/`client_qi`/`platform`), `business_id bigint null`, `user_id uuid null`, `kind ledger_kind` (`service`/`fura_fila`/`platform_fee`/`withdraw`/`withdraw_fee`/`qi_cashback`/`qi_withdraw`/`refund`), `amount_cents int` (com sinal), `payment_id uuid null`, `withdrawal_id uuid null`, `title`, `subtitle`, `created_at`; `unique (payment_id, account, kind)` e `unique (withdrawal_id, account, kind)` | dono do negócio (contas `merchant*`) ou `user_id = auth.uid()` (`client_qi`) |
| `withdrawals` | `id uuid pk`, `source` (`financeiro`/`qi_merchant`/`qi_client`), `business_id null`, `user_id`, `amount_cents`, `fee_cents`, `net_cents`, `pix_key_id uuid null` (rótulo), `status` (`requested`/`processing`/`paid`/`failed`/`manual_pending`), `provider_transfer_id`, `provider_payout_id`, `provider_reversal_id`, `idempotency_key unique`, `failure_code`, timestamps | `user_id = auth.uid()` |
| `pix_keys` | `id uuid pk`, `user_id`, `type pix_key_type`, `value text` (cru, só service role lê), `masked_value text`, `created_at` | **view** `my_pix_keys` sem `value`; tabela sem policy de select para `authenticated`; inserção via RPC `add_pix_key` que mascara no servidor |
| `stripe_events` | `id text pk` (`evt_...`), `type`, `endpoint` (`platform`/`connect`), `received_at`, `processed_at null`, `error text` | sem policy (só service role) |

Também na migration:

- Índice único parcial: `payments (appointment_id) where purpose = 'booking' and status not in ('canceled','failed')`. Garante **uma cobrança viva por agendamento**.
- Funções `security definer` (padrão de `20260706120000_security_hardening.sql`: `set search_path = public`, `revoke ... from public, anon`):
  - `merchant_balance_cents(p_business_id bigint, p_account ledger_account)` e `my_qi_balance_cents()`: soma do ledger com checagem de dono.
  - `apply_payment_event(...)`: aplica a transição de status + lançamentos de ledger numa transação (chamada pelo webhook com service role).
  - `release_unpaid_appointments(p_older_than interval)`: cancela agendamentos com cobrança online não paga além do prazo (§ 7).
  - `record_pay_on_site(p_appointment_id bigint)`: único caminho de escrita do app em `payments`; exige que o caller seja o cliente do agendamento e grava `status = 'pay_on_site'`, `funds_flow = 'none'`, valor de `services.price`.
  - `add_pix_key(p_type pix_key_type, p_value text)`: valida e mascara no servidor (mesma regra de `maskPixValue` em `mockWalletService.ts`).
- Agendamento da limpeza: `pg_cron` se a extensão estiver disponível no projeto (verificar na Task 2); senão o webhook de `payment_intent.canceled` mais o `cancelUnpaid` do app cobrem o caminho feliz e a limpeza vira dívida.

Nenhuma coluna nova em `appointments`: o pagamento vive em `payments` (o `payment_method` existente continua sendo o "método escolhido", como na F5).

## 6. Edge Functions

Código Deno em `supabase/functions/`. Lógica **pura** (sem imports de URL, sem `Deno.*`) em `supabase/functions/_shared/` para o jest testar (o `tsconfig.json` exclui `supabase/functions`, então o jest é a única rede de segurança automática). Handlers finos. Stripe via `npm:stripe` (versão fixada no spike) com `Stripe.createFetchHttpClient()`; webhooks com `constructEventAsync` + `Stripe.createSubtleCryptoProvider()`.

| Função | JWT | Responsabilidade |
|---|---|---|
| `_shared/` | n/a | `cors.ts`, `auth.ts` (usuário do JWT), `admin.ts` (cliente service role), `stripe.ts` (cliente + API version), **puros:** `pricing.ts` (taxa da plataforma, `priceToCents`, cotação de saque espelhando `computeWithdrawQuote`), `fundsFlow.ts`, `ledger.ts` (evento → lançamentos), `idempotency.ts` (chaves determinísticas), `statusMap.ts` (PI → `payment_status`) |
| `payments-cards` | sim | `GET`: garante Customer e lista cartões (`PaymentCard[]`). `POST {action:'setup'}`: cria SetupIntent e devolve `client_secret`. `POST {action:'complete', setupIntentId}`: confirma que o PM ficou anexado, define default se for o primeiro, devolve o `PaymentCard`. |
| `payments-create-intent` | sim | Entrada: `purpose`, `method` (`card`/`pix`), `cardId?`, `amountCents`, `idempotencyKey`. Booking: lê agendamento + serviço, exige `client_id = caller`, calcula valor e taxa, escolhe `funds_flow`. Cria ou reaproveita a linha `payments` (pela `idempotency_key`) e o PI (um por linha; nova tentativa de cartão **reconfirma o mesmo PI** com outro `payment_method`). Devolve `{ paymentId, status, clientSecret?, pix? }`. |
| `payments-cancel` | sim | Cancela o PI não pago de um agendamento do caller e marca o agendamento `canceled`. Idempotente. |
| `stripe-webhook` | **não** (`verify_jwt=false`) | Verifica assinatura (tenta `STRIPE_WEBHOOK_SECRET` e `STRIPE_CONNECT_WEBHOOK_SECRET`), deduplica em `stripe_events`, chama `apply_payment_event`. Erro → 500 para a Stripe reenviar. |
| `connect-onboarding` | sim | Lojista dono do negócio: cria a conta conectada se não houver (`country=BR`, capability `transfers`, payouts manuais), grava `merchant_accounts`, devolve Account Link `account_onboarding`. |
| `connect-return` | **não** | `return_url`/`refresh_url` do Account Link: página HTML mínima que redireciona para `walltoall://financeiro?onboarding=done` (ou gera link novo no refresh). Account Links exigem URL http(s); o scheme do app não serve direto. |
| `wallet-withdraw` | sim | `source` `financeiro`/`qi_merchant`/`qi_client`: recalcula a cotação no servidor, checa saldo no ledger, cria `withdrawals` + lançamentos, executa payout/transfer/reversal conforme § 3.4 ou marca `manual_pending`. |
| `subscriptions` (opcional) | sim | Assinatura do lojista (Task 17 do plano). |

Secrets (Supabase → Edge Functions → Secrets), **definidos pelo usuário**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `PLATFORM_FEE_BPS`, `FURA_FILA_MAX_CENTS`, `CONNECT_RETURN_BASE_URL`, opcional `DEMO_FURA_FILA_BUSINESS_ID`. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` já são injetados pela plataforma.

Observação: o brief previa só `STRIPE_WEBHOOK_SECRET`. Eventos de contas conectadas (`account.updated`, `payout.*`) chegam por um endpoint do tipo **Connect**, que tem segredo de assinatura próprio; por isso o segundo secret.

## 7. Agendamento: reservar, depois cobrar (fecha a dívida da F5)

A F5 registrou: "cartão cobrado e insert do agendamento falhando deixa a cobrança sem estorno". Fluxo novo em `schedule/confirm.tsx`:

1. `createAppointment(draft, { notify: false })` (já existe em `lib/booking/createAppointment.ts`; ganha a opção). Falhou: nada foi cobrado. Fim.
2. Cartão: `wallet.payWithCard(cardId, priceCents, desc, { purpose: { kind: 'booking', appointmentId }, idempotencyKey: 'booking:' + id })`. Pix: abre o `PaymentPixBottomSheet` com o mesmo contexto.
3. Recusado: toast como hoje; o usuário pode trocar de cartão e tentar de novo **no mesmo PI** (sem cobrança dupla). Desistiu (voltar, fechar o sheet Pix): `booking.cancelUnpaid(id)`.
4. Aprovado (lido do banco): `booking.recordPayment(id, paid...)` (na Stripe só valida), notificação ao lojista (`notifyAppointmentRequested`, que hoje roda dentro do `createAppointment`), modal.
5. App morto no meio: o webhook continua gravando o pagamento; `release_unpaid_appointments` cancela reservas sem pagamento após o prazo (proposta 30 min; o Pix expira em 15 min, `PIX_EXPIRY_MS` em `mockWalletService.ts:24`).

"Pagar na hora" não muda: cria o agendamento (com notificação) e grava `pay_on_site`.

Alternativa considerada e descartada: criar o agendamento dentro do webhook depois do pagamento. Exigiria portar validação e conflito de `createAppointment` para Deno e estornar quando o horário fosse ocupado durante um Pix demorado.

Efeito colateral aceito: por até 30 min o lojista pode ver um agendamento `pending` ainda não pago (risco na § 14).

## 8. App

### 8.1 SDK nativo

`npx expo install @stripe/stripe-react-native`; plugin em `app.json` (`["@stripe/stripe-react-native", { "merchantIdentifier": "merchant.com.kavicki.walltoall", "enableGooglePay": false }]`). Atenção: `android/` é versionado e o `expo prebuild` nunca roda aqui (nota pós-implementação da F0 em `2026-07-06-f0-f1-fundacao-aqui-e-agora-plan.md`), então no Android o plugin **não se aplica**: o módulo entra por autolinking e o rebuild basta (com Google Pay desligado o plugin não faria nada no Android). O plugin vale para iOS/EAS, que fazem prebuild. Conferir `minSdkVersion` >= 21 e o tema `AppCompat` em `android/app/src/main/res/values/styles.xml`; `StripeProvider` em `app/_layout.tsx` com `publishableKey` lida de `extra.stripePublishableKey` (via `app.config.js`, a partir de `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`) e `urlScheme="walltoall"` (o scheme já existe no `app.json`). O Android está com `newArchEnabled: false`; o SDK suporta a arquitetura antiga. Jest: `__mocks__/@stripe/stripe-react-native.js` reexportando o mock oficial do pacote (mesmo padrão de `__mocks__/react-native-maps.tsx`). Rebuild do dev client obrigatório.

### 8.2 Seleção da implementação

`EXPO_PUBLIC_PAYMENTS_PROVIDER=stripe|mock` (default `mock`) exposto em `extra.paymentsProvider`. O `ServicesProvider` cria `StripeWalletService` e `StripeBookingPaymentService` quando `stripe` e há publishable key; senão os mocks atuais. O `QueueService` continua mock. Os testes não mudam: `renderWithProviders` injeta mocks.

### 8.3 Confirmação sem confiar no cliente

`lib/payments/awaitPaymentSettled.ts`: helper puro que consulta `getPaymentStatus` em intervalo (2 s) até `succeeded`/`failed`/`canceled` ou timeout (60 s cartão; para Pix, enquanto o sheet estiver aberto). A implementação Stripe lê `payments` via PostgREST (RLS do pagador). Realtime seria mais elegante, mas fila/realtime estão fora deste recorte; polling basta para o piloto.

`PaymentPixBottomSheet` (F1): mostra `qrImageUrl` quando houver (`Image`), senão o placeholder atual; consulta o status enquanto aberto; "Já realizei o pagamento" força uma consulta e, se ainda não pago, mostra "Ainda não identificamos o pagamento". Aproveita para usar o `PaymentProcessingSheet` da F5 e eliminar o "Processando" duplicado (dívida F5).

### 8.4 Cadastro de cartão

`new-card.tsx` troca os campos de número/validade/CVV pelo `CardField` da Stripe (o nome do titular continua no `CustomInput`, vai como `billing_details.name`). O preview `CreditCard` continua: `onCardChange` entrega `last4`, `brand` e validade. Divergência registrada do Figma `2660:6604` (campos desenhados vs componente seguro).

### 8.5 Financeiro do lojista

Sem conta conectada ativa (`payouts_enabled = false`): banner "Ative seus recebimentos" no `financeiro/index.tsx` e o saque bloqueado com o mesmo CTA. O onboarding abre com `WebBrowser.openAuthSessionAsync` (`expo-web-browser` já é dependência). Estado não desenhado no Figma: divergência registrada. Fecha junto o débito da F3 de `financeiro/withdraw.tsx` (`try/finally` sem `catch`), que com rede real vira spinner infinito.

## 9. Onboarding do lojista (Connect)

1. Financeiro → "Ativar recebimentos" → `connect-onboarding`.
2. Função: se não há `merchant_accounts` para o negócio do caller, `POST /v1/accounts` (BR, capability `transfers`, e `card_payments` só se o spike mostrar que destination charge exige `on_behalf_of`); grava a linha; cria `POST /v1/account_links` (`type=account_onboarding`, `return_url`/`refresh_url` apontando para `connect-return`).
3. App abre o link; o lojista preenche o formulário hospedado da Stripe (em test mode, com os dados de teste que o próprio formulário oferece).
4. `account.updated` (endpoint Connect) atualiza `charges_enabled`/`payouts_enabled`/`requirements_due`. O app relê ao voltar (`useFocusEffect`).
5. Demo: vincular a conta de teste existente `acct_1UXBoK3seq5yk1Fo` ao negócio de demonstração por SQL (Task 7 do plano), sem passar pelo formulário.

## 10. Webhook: eventos tratados

**Endpoint da plataforma** (`STRIPE_WEBHOOK_SECRET`):

| Evento | Efeito |
|---|---|
| `payment_intent.succeeded` | `payments.status = succeeded`, `paid_at`, `card_last4`/`card_brand` do `latest_charge`; ledger: crédito do lojista (`service`/`fura_fila`, líquido), `platform_fee`; booking: notificação ao lojista; QI: acúmulo de cashback se houver indicador (§ 13, decisão Q) |
| `payment_intent.processing` | `processing` (Pix aguardando liquidação) |
| `payment_intent.requires_action` | `requires_action` (informativo) |
| `payment_intent.payment_failed` | `failed` com `failure_code` (cartão: PI reutilizável na próxima tentativa) |
| `payment_intent.canceled` | `canceled`; booking: agendamento `canceled` se não pago (inclui Pix expirado) |
| `charge.refunded` | `refunded`; ledger de estorno (reverte crédito do lojista e taxa) |
| `charge.dispute.created` | só registro em `stripe_events` + log (fora do piloto) |
| `setup_intent.succeeded` | define default do Customer se não houver |
| `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` | só na task opcional de assinatura |

**Endpoint Connect** (`STRIPE_CONNECT_WEBHOOK_SECRET`):

| Evento | Efeito |
|---|---|
| `account.updated` | flags de `merchant_accounts` |
| `payout.paid` / `payout.failed` | `withdrawals.status` `paid`/`failed`; falha reverte o débito no ledger |
| `account.application.deauthorized` | marca a conta como desconectada |

## 11. Idempotência

- **Stripe:** toda chamada `POST` leva `Idempotency-Key` determinística (`_shared/idempotency.ts`): `pi:{paymentId}`, `confirm:{paymentId}:{tentativa}`, `transfer:{withdrawalId}`, `payout:{withdrawalId}`, `reversal:{withdrawalId}`, `acct:{businessId}`, `cus:{userId}`.
- **Banco:** `payments.idempotency_key` único (`booking:{appointmentId}`; fura-fila usa UUID gerado pela tela por tentativa de checkout); índice parcial de uma cobrança viva por agendamento; `ledger_entries` único por `(payment_id, account, kind)` e `(withdrawal_id, account, kind)`; `withdrawals.idempotency_key` único.
- **Webhook:** insere `stripe_events (id)`; se já existe com `processed_at`, responde 200 sem reprocessar; processa via `apply_payment_event` (transação); sucesso grava `processed_at`; falha grava `error` e devolve 500 (a Stripe reenvia por até 3 dias). Eventos fora de ordem são tolerados: a transição de status só avança (`succeeded` nunca volta para `processing`), exceto `refunded`.
- **Valor:** booking calculado no servidor (`services.price` → centavos); o `amountCents` do app só é conferido (divergência = erro `amount_mismatch`, preço mudou).
- **Dívidas fechadas:** F5 "cobrado sem agendamento" (§ 7); F1/F3 "falha do `joinQueue` após cartão aprovado re-cobra na nova tentativa" (`fura-fila.tsx:119-121`): a tela guarda o `paymentId` e a `idempotencyKey` da tentativa; nova tentativa reaproveita o pagamento já `succeeded` e só repete o `joinQueue`.

## 12. Dados de teste

| Uso | Dado |
|---|---|
| Cartão aprovado | `4242 4242 4242 4242`, validade futura qualquer, CVC qualquer |
| Aprovado com saldo disponível na hora (demo de saque) | `4000 0000 0000 0077` |
| Recusa genérica | `4000 0000 0000 0002` (`card_declined`) |
| Saldo insuficiente | `4000 0000 0000 9995` (`insufficient_funds`) |
| CVC incorreto / expirado | `4000 0000 0000 0127` / `4000 0000 0000 0069` |
| 3DS obrigatório (setup e pagamento) | `4000 0025 0000 3155` |
| PaymentMethods prontos na API (spike) | `pm_card_visa`, `pm_card_chargeDeclined`, `pm_card_bypassPending` |
| Pix | PaymentIntent Pix em test mode; abrir `next_action.pix_display_qr_code.hosted_instructions_url` e usar a simulação de leitura ("simulate scan") para aprovar ou falhar. O procedimento exato e os campos obrigatórios (nome, e-mail, CPF?) ficam registrados aqui pelo spike |
| Conta conectada | `acct_1UXBoK3seq5yk1Fo` (BR) |
| Onboarding novo | formulário hospedado em test mode com os dados de teste sugeridos pela própria Stripe |

## 13. Decisões de negócio em aberto (valores atuais dos mocks)

| # | Decisão | Valor usado no piloto (origem) |
|---|---|---|
| T | Taxa da plataforma sobre agendamento | **sem valor nos mocks**; `PLATFORM_FEE_BPS` configurável, default `0` |
| F | Preço do fura-fila e o que ele cobra | `furaFilaPriceCents` 1500 (`queueFixtures.ts:12`; outros merchants 2000/2500/3000); a tela soma `SERVICE_BASE_CENTS` 8000 "decorativo" (`fura-fila.tsx:33`). Decidir se cobra só a taxa |
| R | Repasse do fura-fila ao lojista | fixture do extrato credita R$ 8,00 "Taxa de antecipação Fura Fila" (`mockWalletService.ts`, `we_fura_1`) para um preço de R$ 15,00; regra não modelada. Piloto: repasse integral menos `PLATFORM_FEE_BPS` |
| C | Cashback QI | 10% por serviço, bônus mensal R$ 5,00, x2 no Ouro (30 indicados), crédito em 24 h (`qiFixtures.ts:32-41`). Quem custeia (plataforma ou taxa) |
| W | Taxa e mínimo de saque | R$ 5,00 abaixo de R$ 200,00, isento acima; mínimo R$ 30,00 só no QI; "Até 24 horas" (`withdrawQuote.ts`) |
| P | Destino do saque | UI pede chave Pix; Stripe paga em conta bancária (§ 3.4) |
| Q | Saque QI do cliente e vínculo de indicação | sem primitiva Stripe; piloto `manual_pending`. Acúmulo usa `profiles.referred_by` (coluna existe; captação foi removida na F4) |
| E | Política de estorno/cancelamento de agendamento pago | não modelada; piloto: estorno manual pelo dashboard |
| H | Prazo de reserva não paga / validade do Pix | proposta 30 min / 15 min (`PIX_EXPIRY_MS`) |
| S | Plano e preço da assinatura | F7 ainda sem UI |
| X | Quem absorve a tarifa da Stripe | destination charge: a plataforma (padrão) |

## 14. Riscos

| Risco | Mitigação |
|---|---|
| Pix não aceita destination charge, ou Connect BR restringe transfers | Spike na Task 1; fallback B; `funds_flow` por cobrança |
| Taxa de saque sem primitiva nativa no modelo A | Reversão parcial de transfer validada no spike; senão saque via modelo B |
| Troca de PSP na produção (Asaas) | Código Stripe só em `supabase/functions/*` e `lib/services/stripe/*`; schema neutro (`provider*`); interfaces do app intactas |
| Vazamento da secret key | Só em secrets do Supabase, definida pelo usuário no terminal dele; nunca em `.env`, chat, log ou repo; `.env.example` só com nomes |
| Webhook rejeitado pelo gateway do Supabase | `verify_jwt=false` na `stripe-webhook`/`connect-return`; corpo cru para a assinatura |
| Reserva não paga visível ao lojista | Notificação só após pagamento; limpeza em 30 min; `cancelUnpaid` ao desistir |
| Valor do fura-fila vem do cliente | Faixa validada no servidor; some com o backend da fila |
| Edge Functions fora do typecheck | Lógica pura em `_shared/` coberta pelo jest; `deno check` opcional via `npx deno` |
| Rebuild nativo no Windows (OOM de commit) | Checar `FreeVirtualMemory` >= 6-8 GB, `--max-workers=2`; alternativa EAS `development` |
| Ledger divergir da Stripe | Lançamentos só pelo webhook; script de conciliação (saldo da conta conectada x `merchant_balance_cents`) no QA |
| Fundos retidos pela plataforma (modelo B) na produção | Aceito só em test mode; produção resolve com o split do PSP definitivo |
| Fases paralelas (F6/F7) mexendo em zonas compartilhadas | Edições aditivas em `types.ts`, `ServicesContext.tsx`, `test-utils.tsx`, `components/payment/*`; rebase no fim |

## 15. Dívidas das fases anteriores

**Fechadas por este recorte:**

- F5: `MockBookingPaymentService` em memória → tabela `payments` + webhook.
- F5: cobrança sem agendamento (idempotência) → § 7 e § 11.
- F5: "Processando" duplicado no `PaymentPixBottomSheet` → unificado com `PaymentProcessingSheet`.
- F1/F3: re-cobrança do fura-fila quando o `joinQueue` falha (`fura-fila.tsx:119-121`).
- F1: QR do Pix é placeholder não escaneável (`PaymentPixBottomSheet.tsx`, `buildQrMatrix`) → PNG real da Stripe.
- F1/F3: cartão sem tokenização (`PaymentCardBottomSheet.tsx:28-32`, `new-card.tsx`) → SetupIntent + `CardField`.
- F3: carteira do lojista e saque mock → ledger + Connect.
- F3: `financeiro/withdraw.tsx` com `try/finally` sem `catch` (registrado no doc mestre § Fase 4).

**Parcialmente:** F3 "cadastro de cartão sem CPF/débito-crédito, chave Pix sem padrão/verificação": a Stripe expõe `card.funding` (crédito/débito) e o CPF entra se o Pix exigir; padrão e verificação de chave Pix continuam abertos.

**Não fechadas (fora de pagamentos):** captação de indicação removida na F4 (QI só acumula com `referred_by` preenchido); `formatBRL` sem separador de milhar (F4; vai aparecer com saldos reais); `schedule/date.tsx` morta (F5); `CustomTabBar` com 4 tabs (F5); cargas tudo-ou-nada do QI (F4).

## 16. Resultado do spike (2026-11-02)

Sandbox `acct_1UX9o33seqKLeNs2`, API version da conta **`2026-10-28.endive`**, `npm:stripe` latest **23.1.0**. O script `scripts/stripe-spike/spike.sh` foi escrito para a API antiga; os resultados abaixo vêm das chamadas refeitas com os parâmetros novos.

**Mudanças da API que afetam o plano:**

1. `payment_method_types` **não existe mais** (PaymentIntent e SetupIntent). Métodos vêm da configuração do dashboard (dynamic payment methods). Cartão: `automatic_payment_methods[enabled]=true` + `automatic_payment_methods[allow_redirects]=never`. Pix: `payment_method_data[type]=pix` + `return_url` obrigatório (o Pix conta como método com redirect).
2. **Accounts v1 bloqueado para contas novas.** Criar com `POST /v2/core/accounts` (`contact_email` obrigatório; `configuration.recipient.capabilities.stripe_balance.stripe_transfers` exige também `configuration.merchant.capabilities.card_payments`). O Account Link **v1** (`POST /v1/account_links`, `type=account_onboarding`) funciona com a conta v2.
3. **Brasil:** todo `transfer` exige `source_transaction` (charge de origem). **Payout manual não é permitido** ("You cannot be on a manual payout plan in country BR"): a conta conectada fica em payout automático diário (`delay_days` 30 no teste). A plataforma não consegue disparar payout sob demanda.

**Resultados:**

| Bloco | Resultado |
|---|---|
| (a) cartão + destination charge | PASS sem `on_behalf_of`: `succeeded`, transfer criado, `application_fee_amount` aplicado |
| (b) Pix na plataforma | PASS: `requires_action`, `next_action.pix_display_qr_code` com `data`, `image_url_png`, `hosted_instructions_url`, `expires_at`. Sem `billing_details` obrigatório |
| (b2) simulação do Pix | pendente (clique no `hosted_instructions_url`) |
| (c) Pix + destination charge | criação ACEITA (`requires_action`); falta simular para confirmar o transfer |
| (d) transfer da plataforma | PASS só com `source_transaction`; sem ele: `transfers_not_allowed` |
| (e) reversão parcial de transfer | PASS |
| (f) payout na conta conectada | FAIL: payout manual proibido no BR |
| (g) conta nova + link | PASS com Accounts v2 (`merchant.card_payments` + `recipient.stripe_transfers`) + Account Link v1 |
| (h) Customer + SetupIntent | PASS com `automatic_payment_methods` |

Observação: a conta de teste `acct_1UXBoK3seq5yk1Fo` está com capabilities `inactive` e pendências de cadastro, e mesmo assim recebeu destination charge e transfer no test mode.

**Decisão (usuário, 02/11): plataforma segura os fundos; "Sacar" vira transfer.**

- Toda cobrança (agendamento cartão/Pix, fura-fila) é feita **na plataforma** (`funds_flow = 'platform'`); destination charge deixa de ser o modelo-alvo. O ledger credita o lojista no `succeeded`, como antes.
- "Sacar" no Financeiro = um ou mais `transfer` da plataforma para a conta conectada, cada um com `source_transaction` = charge de um pagamento do lojista ainda não repassado (consome os mais antigos primeiro), somando o líquido da cotação. A taxa de saque (R$ 5,00 abaixo de R$ 200,00) é simplesmente não transferida. Não há reversal.
- O payout para o banco é automático (calendário da Stripe para a conta conectada). A tela de saque mantém o fluxo do Figma; muda só o prazo exibido ("Até 24 horas" deixa de valer) e a conclusão significa "transferido para a sua conta Stripe".
- Saque QI do lojista: mesmo mecanismo, com `source_transaction` em pagamentos da plataforma (o cashback é custo da plataforma). Saque QI do cliente segue `manual_pending`.
- Pendências para as tasks: `_shared/fundsFlow.ts` passa a devolver `platform` para todo pagamento online (Task 5); `withdrawPlan` (Task 8) troca payout/reversal por transfers com alocação por charge; o webhook ignora `payout.*` para status de saque (o saque conclui no transfer); eventos `transfer.*` entram no endpoint da plataforma.

**Decisões de execução (Tasks 4 a 6, 02/11):**

- Todo PaymentIntent usa `automatic_payment_methods[enabled]=true` com redirects **permitidos** e `return_url=walltoall://stripe-redirect`. Assim o mesmo PI aceita reconfirmação com outro cartão **ou** com Pix (o Pix conta como método com redirect; com `allow_redirects=never` um PI de cartão não poderia virar Pix). SetupIntent continua com `allow_redirects=never`.
- A notificação "Nova Solicitação de Agendamento" de agendamento pago online sai do **webhook** no `payment_intent.succeeded` (só quando o evento é aplicado pela primeira vez), não do app. Na Task 12 o app chama `createAppointment(draft, { notify: false })` nos pagamentos online e não notifica depois da aprovação; "pagar na hora" continua notificando no `createAppointment`.
- Endpoints de webhook criados pela API (`we_1UXDYt3seqKLeNs2xijEtgpN` plataforma, `we_1UXDYu3seqKLeNs2xCFtjmD4` Connect, `api_version` `2026-10-28.endive`); os signing secrets foram direto para os secrets do Supabase, sem passar por chat ou arquivo.
- Cartão de teste que anexa mas recusa na cobrança: `pm_card_chargeCustomerFail` (`4000 0000 0000 0341`). O `pm_card_chargeDeclined` recusa já no SetupIntent.

**Decisões de execução (Tasks 7 a 9, 02/11):**

- `connect-onboarding`: `GET` devolve `{ status, chargesEnabled, payoutsEnabled, requirementsDue }`; `POST {action:'link'}` cria a conta pela Accounts v2 (por `fetch`, com `Stripe-Version: 2026-10-28.preview` e chave `acct:{businessId}`) e devolve o Account Link v1; `POST {action:'sync'}` relê a conta e atualiza as flags. Conta desconectada responde 409 (reconectar fica fora do piloto). Status do app: `active` só com `payouts_enabled`.
- `connect-return` responde **302 para o deep link** (`walltoall://financeiro?onboarding=done|refresh`) em vez de uma página HTML: o domínio padrão das Edge Functions entrega `text/html` como texto puro. O estado desconhecido vira `refresh` e a entrada nunca é ecoada.
- A conta de teste `acct_1UXBoK3seq5yk1Fo` está vinculada ao negócio demo 39 e segue `pending`: as pendências (dados do representante, faturamento, prova de vida) só saem pelo formulário hospedado. Até lá o saque do negócio 39 responde `payout_account_inactive`.
- Saque (migration `20261102140000_f8_withdraw_transfers.sql`): tabela `payment_transfers` (parte de cada cobrança repassada) e RPCs `begin_withdrawal` / `fail_withdrawal`, sob um lock global. O `begin_withdrawal` confere o saldo, grava o saque e o ledger e aloca o líquido. No Financeiro a alocação usa só as cobranças do próprio negócio, até o líquido do lojista. No QI do lojista ela usa as cobranças da plataforma, primeiro as sem negócio. Um transfer por alocação (`transfer:{saque}:{alocação}`, `transfer_group withdrawal_{id}`). Falha antes do primeiro transfer estorna o ledger (kind `refund`). Falha no meio deixa o saque em `processing`, e o retry com a mesma chave retoma. Saque `paid` = transferido para a conta Stripe do lojista. Não há webhook `transfer.*`: o transfer é síncrono.
- Chave de idempotência do saque vem do app e é gravada como `withdraw:{userId}:{chave}`; repetir com outro valor responde 409 `conflict`. `pixKeyId` é obrigatório e precisa ser do usuário; vira só o rótulo do extrato.
- Limitação conhecida: fura-fila creditado a um negócio demo (`DEMO_FURA_FILA_BUSINESS_ID`) não tem `merchant_business_id`, então não serve de origem para o saque do Financeiro (`no_transfer_source`, 409). Irrelevante enquanto o secret não estiver definido.
- SDK: `@stripe/stripe-react-native` 0.50.3. O plugin no `app.json` precisa de objeto de opções (`{ "enableGooglePay": false }`); sem ele a leitura da config quebra. `StripeRoot` (em `lib/payments`) envolve a árvore só quando `EXPO_PUBLIC_PAYMENTS_PROVIDER=stripe`; secret key no app lança no `app.config.js` e no `resolveStripeConfig`. O rebuild do dev client fica combinado com a lib nativa da F6.

**Decisões de execução (Tasks 14 a 16, 02/11):**

- Cadastro de cartão: `WalletService.cardSetupConfirmsWithStripe` diz se a tela confirma o SetupIntent no SDK (Stripe `true`; mock `false`, que completa o setup sem SDK). `addCard` saiu da interface e ficou só na classe do mock. O `CardField` precisa do SDK nativo, então a tela de novo cartão só abre depois do rebuild do dev client (Task 9), mesmo no modo mock.
- Financeiro: `getPayoutAccountStatus` da Stripe faz `sync` quando o status salvo é `pending` (o `account.updated` pode chegar depois da volta do formulário). O saque usa uma chave `chk_` por tentativa, presa a (valor, chave Pix), reaproveitada no retry; o mesmo vale para o saque do QI.
- Cashback QI: crédito de `QI_CASHBACK_PCT` (default 10, secret não definido) do valor do agendamento, arredondado para baixo, ao `profiles.referred_by` do pagador: `merchant_qi` do negócio quando o indicador é lojista, `client_qi` caso contrário. Autoindicação não conta. Entra na mesma transação do `succeeded` e o estorno total o espelha. Não há débito explícito na conta `platform` (colidiria com o estorno da taxa no unique do ledger); o custo da plataforma é a soma dos `qi_cashback`. Estorno depois de um saque do cashback deixa o saldo QI do indicador negativo (aceito no piloto).
- QI no app: `StripeQiService` híbrido (saldo real pelos RPCs, saque pelo `wallet-withdraw`; código, indicações, extrato, regras e cotação seguem do mock).
- Demo: o cliente QA (`f8.qa.cliente`) tem `referred_by` = lojista QA (negócio 39). Validação de ponta a ponta: o `payment_intent.succeeded` do agendamento 87 (PI pago antes de os endpoints existirem, reenviado pela API `events/{id}/retry`) gravou `merchant +6500` e `merchant_qi +650` no negócio 39.
