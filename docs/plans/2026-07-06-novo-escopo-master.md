# Novo Escopo — Documento Mestre

**Data:** 2026-07-06
**Fonte de design:** [Figma Wall-to-all — página "Updates"](https://www.figma.com/design/c1QOl8EocqBiGd6R2NzrFn/Wall-to-all?node-id=2450-22677&m=dev)
`fileKey: c1QOl8EocqBiGd6R2NzrFn` · página: `2450:22677`

Este é o documento mestre do novo escopo (3 frentes: cliente, lojista e telas/componentes compartilhados). Cada fase ganha seu próprio design doc detalhado + plano de implementação **imediatamente antes de ser executada** (abordagem just-in-time). Este doc guarda o que não muda: decisões, inventário, fases, convenções e riscos.

---

## 1. Decisões tomadas (2026-07-06)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Estratégia de entrega | **UI-first com mocks** — todas as telas fiéis ao Figma primeiro; integrações reais (PSP, realtime, storage de vídeo) na Fase 8 |
| 2 | Ordem de ataque | **Por feature, os 2 lados juntos** (cliente + lojista da mesma feature na mesma fase) |
| 3 | Prioridade #1 de negócio | **Aqui e Agora** (fila + mapa + fura-fila) |
| 4 | Fonte da verdade no Figma | **Frames soltos/🆕 (ids `2715:xxxx`) vencem** as duplicatas dentro das seções; seções valem para telas sem duplicata |
| 5 | Módulos nativos | **Instalar libs reais já na fase de UI**: `react-native-maps`, `expo-camera`, `expo-video` (rebuild único do dev client na Fase 0) |
| 6 | Documentação | **Doc mestre + design doc por fase (just-in-time)** |

## 2. O que o escopo introduz de novo

O código atual (expo-router, grupos `(auth)`/`(client)`/`(merchant)`, Supabase) **não tem**: processamento real de pagamento (nenhum PSP; "pix" é só label no agendamento), mapas, câmera/vídeo, filas em tempo real. O novo escopo adiciona essas 4 capacidades de infraestrutura além das ~60 telas/estados.

## 3. Pipeline de fases

Dependências: `F0 → F1 → F2 → F3 → {F4, F5, F7} → F6 → F8` (F4/F5/F7 dependem dos componentes de pagamento da F3; F6 é independente e fica antes apenas da integração; a ordem F4 → F5 → F6 → F7 é a sequência de execução planejada).

### Fase 0 — Fundação compartilhada ✅ implementada (2026-07-09)
- Libs nativas + rebuild do dev client: `react-native-maps` (provider Google — requer API key), `expo-camera`, `expo-video`
- Camada de serviços mockados (ver §4 Arquitetura)
- Componentes novos do design system:

| Componente | Node ID |
|---|---|
| Top bar (library) | `2715:3617` (instância de referência) |
| bottom-nav (library) | `2715:3680` (instância de referência) |
| drawer cliente / lojista | `2643:8225` / `2567:4975` |
| CreditCard | `2643:8859` |
| cards-stack | `2663:6979` |
| payment-card | `2657:21265` |
| credit-card-flag | `2655:21161` |
| toggle | `2560:5009` |
| slider | `2586:5081` |
| fura-fila-icon | `2596:5943` |

### Fase 1 — Aqui e Agora (cliente + lojista) — prioridade #1 ✅ implementada (2026-07-09)

**Cliente** (seção `2660:6325`):

| Tela | Node ID | Obs |
|---|---|---|
| aqui-agora-map-search 🆕 | `2715:3575` | substitui `2512:482` |
| aqui-agora-waiting-list | `2496:313` | |
| Sua senha — Fura fila ativado | `2643:20265` | |
| aqui-agora-fura-fila-selection | `2513:538` | |
| merchant-profile-view | `2643:8289` | |
| payment-pix-bottom-sheet | `2663:7091` | versão mais nova; anterior `2643:20347` |
| payment-card-bottom-sheet | `2643:20390` | |
| Modal | `2659:6381` | |

**Lojista** (seção `2643:8172`):

| Tela | Node ID | Obs |
|---|---|---|
| aqui-agora-inactive | `2495:254` | |
| aqui-agora-active 🆕 | `2715:3616` | substitui `2576:4907` |
| fila-management | `2590:5155` | |
| fila-management-full | `2596:5847` | |
| aqui-agora-settings | `2509:458` | |
| request-bottom-sheet | `2511:486` | |

### Fase 2 — Dashboards/Home novos (cliente + lojista) ✅ implementada (2026-07-10)

| Tela | Node ID | Obs |
|---|---|---|
| home cliente 🆕 | `2715:3426` | substitui `2590:5530` (seção `2643:19671`) |
| dashboard-update lojista | `2478:111` | seção `2643:8171` |
| drawers (2 lados) | ver Fase 0 | integração na navegação |

### Fase 3 — Carteira (cliente) + Financeiro (lojista) ✅ implementada (2026-07-10)

**Cliente** (seção `2643:19683`):

| Tela | Node ID | Obs |
|---|---|---|
| Wallet 🆕 | `2715:3681` | substitui `2643:19976`, `2660:6732`, `2660:6806` |
| new-card-registration | `2660:6604` | |
| nova-chave-pix-registration | `2660:6529` | |

**Lojista** (seção `2643:8184`):

| Tela | Node ID |
|---|---|
| finantial-empty-state | `2597:5956` |
| finantial-complete | `2602:5991` |
| withdraw | `2602:6092` |
| withdraw-loading | `2622:5836` |
| nova-chave-pix-registration | `2597:6009` |
| request-bottom-sheet | `2602:5329` |
| Modal | `2622:5847` |

### Fase 4: QI (cliente + lojista) ✅ implementada (2026-08-17)

> **Correção da premissa original desta fase.** O título dizia "reaproveita o sistema de referral existente". Não foi o que aconteceu: por decisão do usuário (2026-07-11), o referral legado foi **excluído por completo antes** do QI nascer (Task 1), incluindo o campo de código no signup, a RPC `process_referral` e o deep link `?ref=`. As tabelas e a RPC do Supabase ficaram intactas (nenhuma migration destrutiva), mas o app fica **sem captação real de indicação até a F8**. O QI é domínio novo (`QiService` + `MockQiService`), não evolução do referral.

**Cliente** (seção `2628:7526`): QI-merchant-complete `2628:6934` · QI-merchant-blank `2628:7044` · withdraw 🆕 `2715:3711` (substitui `2628:7092`) · QI-indication-details `2628:7149` · QI-how-it-works `2628:7226` · Modal `2628:7299` · withdraw-loading `2628:7300`

**Lojista** (seção `2628:7682`): QI-merchant-complete `2606:5475` · QI-merchant-blank `2606:6250` · withdraw `2628:6373` · QI-indication-details `2606:5546` · QI-how-it-works `2606:5632` · Modal `2628:6463` · withdraw-loading `2628:6464`

> Nota: `2715:3711` (withdraw 🆕) é a referência de design mais recente para withdraw; ao implementar cada withdraw (QI ×2, Financeiro), comparar screenshots e seguir o 🆕 onde o layout coincidir.

**Divergências deliberadas do Figma nesta fase** (registradas para que a revisão de fidelidade não as trate como defeitos). As três primeiras existem porque seguir o Figma faria o app **contradizer o próprio domínio**:

| # | Divergência | Razão |
|---|---|---|
| 1 | Regra de taxa exibida como "Taxa de R$ 5,00 por saque, isenta a partir de R$ 200,00" | O Figma (`2628:7292`/`2606:5696`) promete "Saques ilimitados sem taxas", mas `computeWithdrawQuote` cobra abaixo do limiar |
| 2 | "30+ indicados ativos" para o nível Ouro | O Figma (`2628:7280`/`2606:5681`) diz "10+", contradizendo o `nextLevel.target` (30) que a tela-mãe exibe |
| 3 | Mínimo de saque vindo de `getProgramRules()` | O Figma (`2628:6427`) afirma mínimo de R$ 50,00; as regras definem R$ 30,00 |
| 4 | Sem top bar nas sub-telas (detalhes, how-it-works, saque) | Modelo de navegação do app: a top bar com menu é das telas-hub; sub-telas empurradas usam o "Voltar" fantasma (precedente em `components/wallet/PixKeyForm.tsx:162`) |
| 5 | Rótulo "Suas indicadas" (lojista) | O Figma traz "Suas indicados" (`2606:5522`, erro de concordância) e "Suas indicações" (`2606:6297`); adotado rótulo único |
| 6 | Status "Inativa" | O Figma só desenha o estado ativo; o tipo e as fixtures exercitam o inativo |
| 7 | "Sem registro" para datas nulas | Caso não desenhado (`firstAppointmentAt`/`lastActivityAt` são anuláveis) |
| 8 | Mensagem própria de extrato vazio | O `QiStatementList` não tem estado vazio próprio (contrato do JSDoc) e o Figma não desenha a seção vazia |
| 9 | Link "Como funciona o QI" acrescentado | Nenhum dos nodes do index prevê entrada; sem ele a tela ficaria inalcançável (decisão #8 do plano) |
| 10 | "Ver o regulamento completo" estático | Sem tela alvo no Figma (decisão #9); `TODO(F8)` |
| 11 | Segundo botão "Cancelar saque" omitido | `2628:6430` duplica a saída que o "Voltar" já oferece |
| 12 | Copy dos modais vinda da spec | `2628:7299`/`2628:6463` são instâncias de biblioteca com placeholder ("Remover Produto?") |

**Dívidas registradas para a F8:** `'Nível Ouro'` ainda é literal em tela (renomear o topo da escada dessincronizaria as duas telas, mesma classe do item 2 acima) · `formatBRL` sem separador de milhar (produz "R$ 1234,56", visível no hero de 32px) · `Promise.all` tudo-ou-nada nas cargas, e falha de recarga por refoco é silenciosa nas 3 telas com `QiScreen`/`QiHowItWorks`/`QiWithdrawScreen` · falha do `QiService` derruba a home do lojista inteira em vez de degradar só o KPI · `router.back()` sem `canGoBack()` (relevante em telas endereçáveis por id, alcançáveis por deep link) · no detalhe da indicação, uma falha só do extrato ejeta o usuário de uma tela válida (`TODO(F8)` no `catch`) · a casca de carga (`loaded`/`reloading`/`runIdRef`/retry) está escrita 3 vezes e é candidata a hook compartilhado.

**Débito herdado da F3, fora do escopo desta fase:** `app/(merchant)/financeiro/withdraw.tsx` tem `try/finally` **sem `catch`** (unhandled rejection e spinner infinito em caso de falha) e o estado de carga não oferece "Voltar". O `components/qi/QiWithdrawScreen.tsx` é o modelo pronto de como corrigir.

### Fase 5 — Agendamento de serviços com pagamento (cliente) — evolução do fluxo atual

Seção `2668:18465`: store-profile-view `2663:7158` · search-results `2663:7678` · searching `2663:7806` · schedule-service `2663:7937` · schedule-service-selected `2663:7960` · schedule-whole-month `2663:7983` / `2663:8015` / `2663:17450` (3 variantes) · schedule-appointment-view `2663:8034` · card-selection `2668:18327` · payment-loading `2663:9149` · Modal `2663:8057`

### Fase 6 — Feed (lojista + cliente)

**Lojista** (seção `2643:7837`): feed `2485:146` · feed-past-post `2563:5334` · record-video-post `2501:396` · preview-post `2502:396`

**Cliente** (seção `2643:7838`): feed `2643:7839`

### Fase 7 — Profile lojista + Assinatura

Profile (seção `2643:8170`): profile-view `2611:6893` · profile-stamps `2625:5970`
Assinatura (seção `2678:149`): subscription-offer `2678:150` · subscription-manage `2680:177`

### Fase 8 — Integração real (planejar em detalhe ao final da UI)
- Backend Supabase por feature: fila em tempo real (Realtime), transações/carteira, posts + storage/streaming de vídeo, assinatura
- Decisão de PSP (Pix, cartão, recorrência) — pré-requisito desta fase
- Google Maps API key de produção, notificações de fila via push existente

## 4. Arquitetura e convenções

**Rotas (expo-router)** — novos grupos seguindo o padrão atual:
- `app/(client)/`: `aqui-agora/`, `wallet/`, `qi/`, `feed/` (`schedule/` evolui na F5)
- `app/(merchant)/`: `aqui-agora/`, `financeiro/`, `qi/`, `feed/`, `assinatura/` (`profile/` e `dashboard/` evoluem)

**Camada de serviços mockados** (coração do UI-first):
- `lib/services/` — interfaces: `QueueService`, `WalletService`, `QiService`, `FeedService`, `SubscriptionService`
- `lib/services/mock/` — implementações com dados fixos + timers simulando realtime (fila andando, senha chamada)
- Telas consomem **apenas a interface** via context; na Fase 8 a implementação vira Supabase sem tocar em tela nenhuma
- Proibido dado hardcoded dentro de tela/componente

**Componentes:** novos compartilhados em `components/` (ex.: `components/payment/` para CreditCard/cards-stack/payment-card). Tokens do tema atual são a base; divergência do Figma vira atualização de tema, nunca estilo inline ad-hoc.

## 5. Processo tela a tela (repetido em toda fase)

1. **Extrair do Figma**: `get_design_context` + screenshot do node-id (tabelas acima)
2. **TDD**: teste de comportamento primeiro (jest, padrão de `__tests__/`)
3. **Implementar** fiel ao Figma usando tokens do tema
4. **Verificar**: typecheck (`NODE_OPTIONS=--max-old-space-size=8192`, já no pre-push) + testes + comparação visual contra screenshot do Figma
5. **Commit** por tela ou grupo coeso

**Critério de "pronto" por tela:** fidelidade visual ao Figma · todos os estados do design (empty/loading/cheio/erro) · navegação de entrada e saída ligada · dados vindos da interface de serviço · testes passando.

## 6. Riscos e pendências

| Risco | Mitigação |
|---|---|
| PSP indefinido (Pix/cartão/assinatura) | Interfaces de serviço isolam a decisão; decidir antes da F8 |
| Google Maps API key | Necessária já na F0/F1 (mapa real); obter key de dev |
| Rebuild do dev client | 3 libs nativas entram juntas na F0 — custo pago uma única vez |
| Custo de vídeo (storage/streaming) | Avaliar na F6/F8; feed mockado não sobe vídeo real |
| Duplicatas no Figma | Regra 🆕 (decisão #4) + verificação por screenshot em cada fase |

## 7. Documentos derivados

| Doc | Quando criar |
|---|---|
| `2026-07-06-novo-escopo-master.md` (este) | ✅ criado |
| Design doc + plano da F0+F1 | ✅ criado; F0+F1 **implementadas** (2026-07-09) — suíte 251/251, typecheck e lint limpos. Pendente: QA em dispositivo (percorrer os 2 fluxos ponta a ponta) + revisão de fidelidade visual vs Figma (`2715:3575`, `2715:3616`). |
| Plano da F2 (dashboards/home) | ✅ criado; F2 **implementada** (2026-07-10) — suíte 300/300, typecheck e lint (0 erros) limpos. Pendente: QA em dispositivo + fidelidade visual vs Figma (`2715:3426`, `2478:111`). |
| Plano da F3 (carteira/financeiro) | ✅ criado; F3 **implementada** (2026-07-10), mock-first (WalletService estendido); suíte 350/350, typecheck e lint (0 erros) limpos. Pendente: QA em dispositivo + fidelidade visual vs Figma (`2715:3681`, `2602:5991`, `2715:3711`). Débitos de fidelidade: cadastro de cartão sem CPF/débito-crédito, chave Pix sem "padrão"/verificação, a casar com o backend na F8. **Débito do saque sem resumo de taxa: FECHADO na F4** (Task 5), com o withdraw do Financeiro retrofitado no `WithdrawFlow` compartilhado. Aberto na F4: o wrapper do saque do Financeiro não tem `catch` na carga (ver § Fase 4). |
| Plano da F4 (QI) | ✅ criado; F4 **implementada** (2026-08-17), mock-first (`QiService` + `MockQiService`, fixtures do Figma); suíte 463/463 em 57 suítes, typecheck 0 erros, lint sem nenhum problema novo (o único warning em arquivo tocado é pré-existente, commit `4a33246f`). Referral legado **removido por completo**, incluindo o campo de código no signup: `git grep -ri referral` em `app/ components/ lib/ __tests__/` retorna zero hits, e a captação real de indicação só volta na F8. Fecha o débito do resumo de taxa da F3. Pendente: QA em dispositivo (cliente e lojista: QI → detalhes → como funciona → saque com saldo atualizado; financeiro com resumo de taxa; signup sem campo de código) + revisão de fidelidade visual vs Figma (`2628:6934`, `2606:5475`, `2628:7149`, `2628:7226`, `2715:3711`), contra a tabela de 12 divergências deliberadas da § Fase 4. |
| Design doc + plano das demais fases | imediatamente antes de cada fase |
| Plano da F8 (integração) | ao final da F7, com PSP decidido |
