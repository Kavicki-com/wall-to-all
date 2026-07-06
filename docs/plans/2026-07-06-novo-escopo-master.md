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

### Fase 0 — Fundação compartilhada
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

### Fase 1 — Aqui e Agora (cliente + lojista) — prioridade #1

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

### Fase 2 — Dashboards/Home novos (cliente + lojista)

| Tela | Node ID | Obs |
|---|---|---|
| home cliente 🆕 | `2715:3426` | substitui `2590:5530` (seção `2643:19671`) |
| dashboard-update lojista | `2478:111` | seção `2643:8171` |
| drawers (2 lados) | ver Fase 0 | integração na navegação |

### Fase 3 — Carteira (cliente) + Financeiro (lojista)

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

### Fase 4 — QI (cliente + lojista) — reaproveita o sistema de referral existente

**Cliente** (seção `2628:7526`): QI-merchant-complete `2628:6934` · QI-merchant-blank `2628:7044` · withdraw 🆕 `2715:3711` (substitui `2628:7092`) · QI-indication-details `2628:7149` · QI-how-it-works `2628:7226` · Modal `2628:7299` · withdraw-loading `2628:7300`

**Lojista** (seção `2628:7682`): QI-merchant-complete `2606:5475` · QI-merchant-blank `2606:6250` · withdraw `2628:6373` · QI-indication-details `2606:5546` · QI-how-it-works `2606:5632` · Modal `2628:6463` · withdraw-loading `2628:6464`

> Nota: `2715:3711` (withdraw 🆕) é a referência de design mais recente para withdraw; ao implementar cada withdraw (QI ×2, Financeiro), comparar screenshots e seguir o 🆕 onde o layout coincidir.

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
| Design doc + plano da F0+F1 | antes de iniciar a F0 (próximo passo) |
| Design doc + plano das demais fases | imediatamente antes de cada fase |
| Plano da F8 (integração) | ao final da F7, com PSP decidido |
