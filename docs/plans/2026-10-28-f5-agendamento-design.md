# F5: Agendamento de serviços com pagamento (cliente). Design

**Data:** 2026-10-28
**Fase:** 5 do novo escopo (`docs/plans/2026-07-06-novo-escopo-master.md`, § Fase 5)
**Branch:** `feat/f5-agendamento` (worktree `.worktrees/f5-agendamento`)
**Figma:** fileKey `c1QOl8EocqBiGd6R2NzrFn`, seção "Agendamento de serviços - cliente" `2668:18465`
**Paralelismo:** F5, F6 e F7 rodam ao mesmo tempo em sessões separadas. Território e zonas compartilhadas na § 7.

A F5 é EVOLUÇÃO do fluxo de agendamento existente, que já usa Supabase real (loja, busca, serviço, data e hora, confirmação, detalhe do agendamento). O que a fase acrescenta: a confirmação ganha pagamento (Pix ou cartão) com mock, a seleção de cartão em bottom sheet, o sheet "Processando seu pagamento...", o modal de sucesso redesenhado, e o detalhe do agendamento passa a mostrar como foi pago. Nenhuma rota nova: todos os frames do Figma caem em rotas existentes.

---

## 1. Decisões (2026-10-28)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Dados do agendamento | **Supabase real continua** (tabela `appointments`, enum `payment_method` pix/card/cash). Sem migration nesta fase. |
| 2 | Pagamento | **Mock-first**: cobrança via `WalletService` (já existe: `createPixCharge`, `payWithCard`). O que a F5 cria é o **registro do pagamento por agendamento**, num serviço novo (`BookingPaymentService`), porque o schema não tem onde guardar "pago" sem migration. |
| 3 | Ordem na confirmação | **Cobrar primeiro, gravar depois**: pagamento (mock) → `createAppointment` (Supabase) → `recordPayment` (mock). Cartão recusado nunca cria agendamento. Falha do insert após cobrança: toast de erro e dívida de idempotência para a F8 (mesma nota já registrada no fura-fila da F1). |
| 4 | Fronteira do serviço | **Interface nova em arquivo próprio** (`lib/services/bookingTypes.ts`), não extensão do `WalletService`. Razões: `WalletService` é zona compartilhada que a F7 também consome; o registro de pagamento é domínio do agendamento, não da carteira; `types.ts` fica intocado (nem a linha de re-export, para não criar ciclo de import entre `types.ts` e `bookingTypes.ts`; consumidores importam direto de `bookingTypes`). |
| 5 | Lógica Supabase da confirmação | **Extraída para `lib/booking/createAppointment.ts`** (validações, conflito, insert, notificação best-effort), movida como está e coberta por teste de caracterização ANTES de qualquer mudança de UI. A tela fica fina e a orquestração do pagamento vira testável. |
| 6 | Componentes de pagamento reaproveitáveis | `CardSelectionBottomSheet` e `PaymentProcessingSheet` nascem em **`components/payment/`** como arquivos NOVOS (aditivo na zona compartilhada), com props genéricas (sem tipos do agendamento), para a F7 (assinatura) importar depois do merge. `CardsStack` ganha cascata com rank único, retrocompatível. |
| 7 | Componentes só do agendamento | Em **`components/booking/`**: `BookingConfirmCard` (substitui `components/ui/ScheduleConfirmCard`, usado só por `confirm.tsx`) e `BookingPaymentStatusRow` (detalhe do agendamento). |
| 8 | Navegação das sub-telas | **Mantém `AppHeader` com Voltar** nas telas empurradas (store, search, schedule). O Figma desenha a top bar com menu em todas; o precedente da F4 (divergência #4) define que a top bar com menu é das telas-hub. Registrado como divergência deliberada. |
| 9 | "Pagar na hora" | Cria o agendamento sem cobrança, com `payment_method` = método selecionado (pix/card/cash) e registro `pay_on_site`. Com "Dinheiro" selecionado, "Realizar pagamento" fica desabilitado (só "Pagar na hora" faz sentido). |
| 10 | Pix | "Realizar pagamento" com Pix abre o `PaymentPixBottomSheet` da F1 (node `2663:7091`), sem alteração nele. A seção da F5 não desenha o passo Pix. |
| 11 | Rota `schedule/date.tsx` | **Não tocar.** Está morta (`service.tsx` empurra direto para `time.tsx`), mas removê-la exige tirar um `Tabs.Screen` do `_layout.tsx`, zona compartilhada só aditiva nesta rodada. Dívida F8. |
| 12 | Tela de lista de agendamentos | A 3ª variante do schedule-whole-month (`2663:17450`) é a tela "Meus agendamentos" (`app/(client)/appointments/index.tsx`), já implementada e fiel. **Sem mudança** (fora do território da F5). |

## 2. Frames do Figma x telas existentes (pergunta 1)

Comparação feita com screenshot de cada node (28/10) contra o código atual na main.

| Frame | Node | Tela atual | Veredito |
|---|---|---|---|
| store-profile-view | `2663:7158` | `app/(client)/store/[id].tsx` | **Evolui (ajuste fino).** Já tem bricks, hero, ratings e preço médio, endereço, horário, pagamentos, "Serviços", "Agendar serviços" e "Avaliar". Diferenças: top bar com menu (decisão #8) e passada de fidelidade (espaçamentos, tipografia). Sem selos. |
| search-results | `2663:7678` | `app/(client)/search/results.tsx` | **Evolui (ajuste fino).** SearchBar cinza com filtro vermelho, "Principais resultados" (BusinessCard horizontal), "Principais serviços" (TopServiceCard), "Agendar serviços" outline: tudo existe. Passada de fidelidade. |
| searching | `2663:7806` | `app/(client)/search/index.tsx` | **Evolui (ajuste fino).** SearchBar azul, dropdown de sugestões, chips de categoria: tudo existe. Passada de fidelidade. |
| schedule-service | `2663:7937` | `app/(client)/schedule/service.tsx` | **Evolui.** "Continuar" passa a ser sempre visível e desabilitado (cinza) sem seleção; hoje o botão some. Título "Serviços disponíveis" (o Figma traz "dispníveis", erro de digitação). |
| schedule-service-selected | `2663:7960` | idem | Mesmo arquivo, estado com seleção: borda vermelha no escolhido, demais com opacidade. Já existe. |
| schedule-whole-month | `2663:7983` | `app/(client)/schedule/time.tsx` | **Evolui.** Estado: calendário expandido ("Ocultar"), "17 de Set. Hoje", lista de slots, "Continuar" desabilitado (azul claro). Hoje o botão some sem seleção. |
| schedule-whole-month | `2663:8015` | idem | Estado: calendário colapsado ("Ver tudo"), slot "10h às 11h" selecionado (fundo `surfacePrimaryLight`, borda navy), "Continuar" ativo. Já existe. |
| schedule-whole-month | `2663:17450` | `app/(client)/appointments/index.tsx` | **Não é estado do fluxo** (decisão #12): calendário + "17 de Set. Hoje" + `AppointmentCard` (11:00, Data 17/09/25, serviço, loja, chevron) + "Agendar serviços". Tela existente, fiel. Sem mudança. |
| schedule-appointment-view | `2663:8034` | `app/(client)/schedule/confirm.tsx` + `ScheduleConfirmCard` | **Evolui substancialmente.** Título "Confirmar agendamento"; card "SERVIÇO SOLICITADO" (nome, "Hoje 14/05/2026 - 10h", valor e "A pagar") no estilo do fura-fila; loja (avatar + nome) e endereço; "Selecione o método de pagamento" com radios PIX/Cartão/Dinheiro; linha do cartão escolhido ("Pagamento com Cartão", •••• last4, bandeira, "Alterar >"); Observações; CTAs "Realizar pagamento" (navy, ícone check) e "Pagar na hora" (outline). |
| card-selection | `2668:18327` | (não existe) | **Novo:** bottom sheet "Meus cartões" com `CardsStack` (ativo à frente) e CTA outline "Selecionar cartão". Aberto pelo "Alterar". |
| payment-loading | `2663:9149` | estado "Processando" dentro do `PaymentPixBottomSheet` (F1) | **Novo componente:** sheet com logo de tijolos (`assets/bricks.svg` via `lib/assets`) e "Processando seu pagamento...". Usado pela cobrança em cartão. O sheet Pix da F1 mantém o estado próprio (não é alterado). |
| Modal | `2663:8057` | `components/AppointmentSuccessModal.tsx` | **Evolui (mínimo).** Check verde + "Agendamento concluído" + "Fechar" como link navy (hoje é botão preenchido). O Figma traz "Agendametno" (erro de digitação). Usado só por `confirm.tsx`. |

## 3. As 3 variantes de schedule-whole-month (pergunta 3)

Duas são estados da mesma tela (`time.tsx`), a terceira é outra tela:

- `2663:7983`: `time.tsx`, calendário expandido, nenhum slot selecionado, CTA desabilitado.
- `2663:8015`: `time.tsx`, calendário colapsado, slot selecionado, CTA habilitado.
- `2663:17450`: `appointments/index.tsx` ("Meus agendamentos"), calendário expandido mostrando o agendamento do dia. Fora da F5.

O estado expandido/colapsado já é interno do `MonthCalendar` ("Ver tudo"/"Ocultar"). O que muda em `time.tsx` é só o CTA sempre visível com `disabled`.

## 4. Pagamento mock dentro de um fluxo com Supabase real (pergunta 2)

### 4.1 Fronteira

```
confirm.tsx (tela fina)
  ├─ wallet.payWithCard / PaymentPixBottomSheet   ← WalletService (mock, F0/F1, intocado)
  ├─ createAppointment(draft)                       ← lib/booking/createAppointment.ts (Supabase REAL, extraído de confirm.tsx)
  └─ booking.recordPayment(appointmentId, ...)      ← BookingPaymentService (mock novo; F8 vira tabela + PSP)
appointments/[id].tsx
  └─ booking.getPayment(appointmentId)              ← mesmo serviço; sem registro cai no rótulo payment_method (como hoje)
```

### 4.2 `BookingPaymentService` (`lib/services/bookingTypes.ts`)

```ts
import type { CardBrand } from './types';

/** Espelha o enum `payment_method` do Supabase. */
export type BookingPaymentMethod = 'pix' | 'card' | 'cash';
export type BookingPaymentStatus = 'paid' | 'pay_on_site';

export interface BookingPayment {
  appointmentId: number;
  status: BookingPaymentStatus;
  method: BookingPaymentMethod;
  amountCents: number;
  /** Só quando method === 'card' e status === 'paid'. */
  cardLast4: string | null;
  cardBrand: CardBrand | null;
  /** ISO 8601; null em pay_on_site. */
  paidAt: string | null;
}

export type BookingPaymentInput = Omit<BookingPayment, 'appointmentId' | 'paidAt'>;

export interface BookingPaymentService {
  /** Idempotente por appointmentId (regrava). Rejeita amount <= 0, 'paid' com 'cash', e 'paid' + 'card' sem last4. */
  recordPayment(appointmentId: number, payment: BookingPaymentInput): Promise<BookingPayment>;
  getPayment(appointmentId: number): Promise<BookingPayment | null>;
}
```

Mock: `lib/services/mock/mockBookingPaymentService.ts`, `Map<number, BookingPayment>` em memória, `delay()` como nos outros mocks, `SIMULATED_LATENCY_MS` exportado. Injetado no `ServicesProvider` como `booking` (+ `useBookingPaymentService`) e no `renderWithProviders` (+ override e retorno `booking`). Ambas as edições são aditivas.

### 4.3 `lib/booking/createAppointment.ts` (Supabase real)

Move, sem alterar comportamento, o corpo de `handleConfirm` de `confirm.tsx`: `getUser`, `validateTime`/`validateDate`, data futura, `checkAppointmentConflicts`, `insert` em `appointments` (com `payment_method` e `client_notes`) e a notificação best-effort (`notifyAppointmentRequested`, nunca bloqueia). Assinatura:

```ts
export interface AppointmentDraft {
  businessId: number; serviceId: number; serviceName: string; durationMinutes: number;
  date: string;          // yyyy-MM-dd
  time: string;          // HH:mm
  paymentMethod: BookingPaymentMethod;
  observations: string;
}
export type BookingErrorCode = 'unauthenticated' | 'invalid_time' | 'past_date' | 'conflict' | 'insert_failed';
export class BookingError extends Error { constructor(public readonly code: BookingErrorCode, message: string) }
export async function createAppointment(draft: AppointmentDraft): Promise<{ id: number; startTime: string; endTime: string }>;
```

A tela mapeia `code` para os mesmos toasts de hoje. Teste de caracterização com o mock de `lib/supabase` no padrão de `__tests__/client-home-redesign.test.tsx` (acrescido de `insert`/`single`).

### 4.4 Orquestração em `confirm.tsx`

- Carrega serviço e loja (como hoje) e os cartões via `useWalletService().getCards()` (default pré-selecionado). `priceCents = Math.round(service.price * 100)` (`Service.price` do Supabase é em reais).
- "Realizar pagamento":
  - Pix: abre `PaymentPixBottomSheet` (F1). No `onSuccess`: `createAppointment` → `recordPayment({ status: 'paid', method: 'pix' })` → modal.
  - Cartão: abre `PaymentProcessingSheet`, `await Promise.all([wallet.payWithCard(cardId, priceCents, descricao), delay(PROCESSING_MIN_MS)])`. Recusado: fecha o sheet, toast "Pagamento recusado. Tente outro cartão.", nada é gravado. Aprovado: `createAppointment` → `recordPayment({ status: 'paid', method: 'card', cardLast4, cardBrand })` → modal.
  - Dinheiro: CTA desabilitado.
- "Pagar na hora": `createAppointment` → `recordPayment({ status: 'pay_on_site', method })` → modal.
- "Alterar": abre `CardSelectionBottomSheet`; `onSelect` troca o cartão da linha. Sem cartão salvo e método cartão: a linha vira "Nenhum cartão salvo" com link para `/(client)/wallet/new-card` e "Realizar pagamento" fica desabilitado.
- Modal "Agendamento concluído" → `router.replace('/(client)/appointments')` (hoje vai para a home; a lista `2663:17450` é o destino natural). Registrado como divergência de navegação.

## 5. Componentes

### 5.1 `components/payment/` (zona compartilhada: só arquivos novos + `CardsStack` retrocompatível)

- **`CardsStack`**: hoje a profundidade é `|index - activeIndex|`, o que colapsa cartões em lados opostos do ativo (limitação anotada no próprio arquivo, "revisitar na F5"). Passa a usar um **rank único por cartão** (ordenado por distância ao ativo, empate para o índice menor), de modo que translateY e zIndex nunca se repetem. Com `activeIndex = 0` o resultado é idêntico ao atual (rank = index): a carteira (F3) e os testes existentes não mudam.
- **`CardSelectionBottomSheet`** (node `2668:18327`): props `{ visible, cards: PaymentCard[], selectedCardId: string | null, onSelect(card), onClose, title? = 'Meus cartões', confirmLabel? = 'Selecionar cartão' }`. Estado interno `activeIndex` iniciado pelo `selectedCardId`; tocar num cartão da pilha o traz à frente; o CTA confirma o ativo. Genérico (F7 reaproveita).
- **`PaymentProcessingSheet`** (node `2663:9149`): props `{ visible, message? = 'Processando seu pagamento...' }`. Puramente visual (alça + `LogoWallToAllSvg` + texto); quem controla a duração é o chamador. Genérico (F7 reaproveita).

### 5.2 `components/booking/` (território da F5)

- **`BookingConfirmCard`** (node `2663:8034`): props `{ serviceName, priceCents, dateTimeLabel, businessName, address?, logoUrl?, method, onChangeMethod, selectedCard: PaymentCard | null, onChangeCard, observations, onChangeObservations, onPayNow, onPayOnSite, submitting, payNowDisabled }`. Linha do método: cartão → "Pagamento com Cartão" + `CardBrandFlag` + "•••• last4" + "Alterar >"; Pix → "Pagamento via PIX" + "QR Code na próxima etapa" (sem Alterar); Dinheiro → sem linha. Substitui `components/ui/ScheduleConfirmCard.tsx`, que é removido (único consumidor é `confirm.tsx`).
- **`BookingPaymentStatusRow`**: props `{ payment: BookingPayment | null, fallbackMethod: BookingPaymentMethod }`. Textos: "Pago com cartão •••• 4242", "Pago via Pix", "Pagar na hora (Cartão)". Inserido em `appointments/[id].tsx` abaixo do card principal; sem registro mostra o rótulo do `payment_method` (equivalente ao de hoje).

### 5.3 Evoluções pontuais

- `AppointmentSuccessModal`: "Fechar" vira link navy; texto "Agendamento concluído"; ícone check `surfaceSuccess`.
- `schedule/service.tsx` e `schedule/time.tsx`: CTA sempre no footer, `disabled` sem seleção (estilo cinza/azul claro via `CustomButton`).
- `store/[id].tsx`, `search/index.tsx`, `search/results.tsx`: passada de fidelidade contra o screenshot (tokens e espaçamento), sem mudança de comportamento.

## 6. Divergências deliberadas previstas (pergunta 4)

| # | Divergência | Razão |
|---|---|---|
| 1 | Sub-telas com `AppHeader` (Voltar) em vez da top bar com menu | Precedente F4 #4: top bar com menu é das telas-hub |
| 2 | "Serviços disponíveis" | Figma `2663:7937` traz "dispníveis" |
| 3 | "Agendamento concluído" | Figma `2663:8057` traz "Agendametno" |
| 4 | Pilha com 2 cartões no card-selection | Figma desenha 3; as fixtures do `MockWalletService` têm 2 e os testes da F1/F3 contam cartões. Não alterar fixture |
| 5 | "•••• 4242 / Visa" na linha do cartão | Figma traz "0928 / VISA" estático; a linha mostra o cartão real do mock |
| 6 | Bottom nav com 4 ícones | Figma mostra 5 (inclui o raio do Aqui e Agora); decisão herdada da F1/F2, fora da F5 |
| 7 | Passo Pix reaproveita o sheet da F1 | A seção da F5 não desenha o Pix; node `2663:7091` é o desenho mais recente |
| 8 | "Realizar pagamento" desabilitado com Dinheiro | Estado não desenhado; pagar online em dinheiro não existe |
| 9 | Linha "Pagamento via PIX" e ausência de linha com Dinheiro | O Figma só desenha a linha do cartão |
| 10 | Preço com centavos ("R$ 65,00") | Figma mostra "R$ 65"; `formatBRL` é o padrão do app |
| 11 | Observações com placeholder vazio | O Figma mostra um texto de exemplo preenchido |
| 12 | Toast "Pagamento recusado" e "Nenhum cartão salvo" | Estados não desenhados; o mock recusa ids desconhecidos |
| 13 | "Processando..." com duração mínima simulada | O mock responde na hora; sem o mínimo o sheet piscaria |
| 14 | Fechar o modal vai para "Meus agendamentos" | Hoje vai para a home; a lista (`2663:17450`) é o destino coerente com o fluxo |
| 15 | Lista de agendamentos (`2663:17450`) inalterada | Fora do território; já fiel |

## 7. Paralelismo: território, zonas compartilhadas e dependências cruzadas

**Território F5 (livre):** `app/(client)/schedule/*`, `app/(client)/store/*`, `app/(client)/search/*`, `app/(client)/appointments/[id].tsx`, `components/booking/*`, `lib/booking/*`, `lib/services/bookingTypes.ts`, `lib/services/mock/mockBookingPaymentService.ts`, `components/AppointmentSuccessModal.tsx`, `components/ui/ScheduleConfirmCard.tsx` (removido), testes novos.

**Zonas compartilhadas tocadas (aditivo e mínimo):**

| Arquivo | Mudança |
|---|---|
| `context/ServicesContext.tsx` | + `booking` no tipo, ref, singleton default e hook `useBookingPaymentService` |
| `__tests__/test-utils.tsx` | + override e retorno `booking` |
| `components/payment/CardsStack.tsx` | rank único por cartão (retrocompatível; saída idêntica para `activeIndex = 0`) |
| `components/payment/CardSelectionBottomSheet.tsx` | arquivo novo |
| `components/payment/PaymentProcessingSheet.tsx` | arquivo novo |
| `lib/services/types.ts` | **sem mudança** (decisão #4) |
| `app/(client)/_layout.tsx` | **sem mudança** (nenhuma rota nova) |
| `components/layout/*DrawerItems.ts`, tema | **sem mudança** |

**Dependências cruzadas:**

- **F7 profile-view/profile-stamps x store-profile-view:** o screenshot de `2663:7158` não tem selos nem blocos exclusivos do perfil do lojista; os blocos usados (`ProfileHero`, `RatingsRowCard`, `ProfileAddressCard`, `OperatingHoursCard`, `PaymentMethodsCard` em `components/profile/`) já existem e são compartilhados. A F5 **não altera** `components/profile/*`. Se a F7 precisar mudar algum deles, a mudança tem de ser retrocompatível. Nenhum placeholder necessário.
- **F7 assinatura x pagamento:** a F7 deve consumir `CardSelectionBottomSheet` e `PaymentProcessingSheet` (ambos genéricos) e os sheets `PaymentCardBottomSheet`/`PaymentPixBottomSheet` da F1. Até o merge da F5, a F7 não deve criar arquivos com esses nomes em `components/payment/`.
- **F6:** sem sobreposição.

## 8. Testes e verificação

TDD por task (jest, `__tests__/`, `renderWithProviders`; `jest.mock('expo-router')` por arquivo; mock de `lib/supabase` no padrão `client-home-redesign` onde a tela lê Supabase):

- `mock-booking-payment-service.test.ts`: registro, leitura, idempotência, validações.
- `booking-create-appointment.test.ts`: caracterização (feliz, não autenticado, hora inválida, passado, conflito, falha do insert, notificação não bloqueia).
- `card-selection-bottom-sheet.test.tsx`, `payment-processing-sheet.test.tsx`; `payment-components.test.tsx` estendido (rank único do `CardsStack` + regressão `activeIndex = 0`).
- `booking-confirm-card.test.tsx`, `booking-payment-status-row.test.tsx`.
- `schedule-confirm.test.tsx` (Pix, cartão aprovado, cartão recusado, pagar na hora, dinheiro desabilita CTA, sem cartão), `schedule-service.test.tsx`, `schedule-time.test.tsx` (CTA desabilitado/habilitado).
- `client-appointment-detail-payment.test.tsx` (linha de status com e sem registro).

Verificação por tela (§ 5 do doc mestre): typecheck com `NODE_OPTIONS=--max-old-space-size=8192`, `npx jest --maxWorkers=2`, lint, comparação visual contra os screenshots. Rodar a suíte completa só nos marcos, nunca ao mesmo tempo que outra sessão. Baseline medida no worktree em 28/10: 57 suítes, 463 testes.

## 9. Dívidas registradas para a F8

- `MockBookingPaymentService` é em memória: o status de pagamento some ao reiniciar o app e o detalhe cai no rótulo `payment_method`. F8: tabela `appointment_payments` (ou colunas em `appointments`) + PSP + webhook.
- Idempotência: cartão cobrado e insert do agendamento falhando deixa a cobrança sem estorno (mock inócuo). F8: cobrança idempotente ou agendamento criado em "aguardando pagamento" antes da captura.
- `schedule/date.tsx` morta, com `Tabs.Screen` órfão em `_layout.tsx` (decisão #11).
- `PaymentPixBottomSheet` mantém o próprio estado "Processando", duplicando `PaymentProcessingSheet`. Unificar quando a F1 puder ser tocada.
- `generateTimeSlots` em `time.tsx` só gera slots de 1h e normaliza durações "estranhas" por heurística. Não tocado nesta fase.
- `CustomTabBar` com 4 tabs (Figma: 5).
- `RescheduleAppointment` (detalhe) ainda recebe `paymentMethod` só como rótulo; a linha de status fica ao lado dele, não dentro (evita tocar um componente que o lojista também usa).
