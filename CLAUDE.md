# Wall-to-All

> Situação atualizada em 2026-11-04. Repositório público: não registre aqui segredos, IDs de conta nem dados de usuários.

## 1. O que é o app

App mobile que conecta clientes a prestadores de serviços locais (`README.md`).

- **Cliente:** busca de serviços, agendamento, Aqui e Agora (fila, mapa e fura-fila), carteira, QI e feed.
- **Lojista:** painel do negócio, serviços e preços, agenda, fila, financeiro, feed, perfil e assinatura.

O escopo atual vem de `docs/plans/2026-07-06-novo-escopo-master.md`, dividido em fases F0 a F8.

## 2. Stack

- **App** (`package.json`): Expo ~54.0.31, Expo Router ~6.0.21, React 19.1.0, React Native 0.81.5, TypeScript ~5.9.2.
- **Backend:** Supabase (supabase-js ^2.85.0), com Edge Functions em Deno e migrations em `supabase/migrations/`.
- **Pagamentos:** `@stripe/stripe-react-native` 0.50.3, em **test mode**. Provedor escolhido por `EXPO_PUBLIC_PAYMENTS_PROVIDER` (`mock` ou `stripe`).
- **Nativos:** react-native-maps 1.20.1, expo-camera ~17.0.10, expo-video ~3.0.16, expo-notifications ~0.32.16, Sentry ~7.2.0.
- **Testes:** Jest ^29.7.0 com jest-expo ~54.0.16.
- **Identificação** (`app.json`): versão 1.0.0, `versionCode` 14. `eas.json` tem perfis development, preview e production.

**Comandos:** `npm start`, `npm test` (`npx jest --maxWorkers=2` na suíte completa), `npm run lint`. Typecheck exige heap maior: `NODE_OPTIONS=--max-old-space-size=8192 npm run ci:check`, que é o que o hook de pre-push roda. O CI (`.github/workflows/ci.yml`) faz typecheck, lint e testes.

**Regras do doc mestre e do design da F8:**

- Telas usam só as interfaces de `lib/services/`; é proibido dado hardcoded em tela ou componente.
- Código específico da Stripe fica em `supabase/functions/*` e `lib/services/stripe/*`, porque o provedor de produção ainda pode mudar.
- Secrets de pagamento só nos secrets do Supabase, nunca no app, em `.env` ou no repo.
- Aprovação de pagamento vem do banco, gravada pelo webhook, nunca só do retorno do cliente.

## 3. Situação real

**Em desenvolvimento.**

| Afirmação | Evidência | Data |
|---|---|---|
| Pagamentos em test mode, "para o piloto e a demo" | `docs/plans/2026-11-02-f8-pagamentos-stripe-design.md`, decisão 1 | 2026-11-02 |
| Provedor de pagamento de produção ainda não decidido | mesmo documento, decisão 1 | 2026-11-02 |
| Pagamentos Stripe entraram na `main` | merge `d130a50` (PR #12) | 2026-11-03 |
| Perfil do lojista e assinatura entraram na `main` | merge `918cb43` (PR #13) | 2026-11-03 |
| QA em dispositivo pendente nas fases concluídas | doc mestre, §7 | atualizado até F6 |

- **Lojas:** não há link de loja, nota de release nem doc de status de publicação no repo. `eas.json`, `versionCode` 14 e o trecho "Submit para Play Store" do README mostram configuração, não publicação. Se alguma versão já foi às lojas: não determinado pelos arquivos.
- **Piloto:** é citado como destino dos pagamentos; se já está rodando e com quem: não determinado pelos arquivos.

## 4. Em andamento

- Branch `main` em `d130a50` (2026-11-03), alinhada com `origin/main`.
- `git status` e `git diff --stat`: limpos em 2026-11-04.
- Entregas mais recentes: F8 pagamentos (agendamento, Pix, carteira, saque, Connect, QI, assinatura do lojista) e F7 (perfil e assinatura).
- Única branch com commits fora de `main`: `origin/docs/f7-master-plan`, 1 commit (`ee80b07`, 2026-11-03), que marca a F7 como implementada no doc mestre.
- `feat/ui-updates` (local, 2026-01-23) já está contida em `main`.

## 5. Pendências

**Documentação:**

- Doc mestre na `main` não marca a F7 (depende de `ee80b07`) nem o recorte de pagamentos da F8 (passo previsto no plano da F8, Task 19).
- `README.md` não cobre o escopo novo nem a Stripe.

**Validação:**

- QA em dispositivo e fidelidade ao Figma listados como pendentes para F0 a F6 (doc mestre, §7).
- Roteiro de demonstração da F8 (plano da F8): resultado no dispositivo não determinado pelos arquivos.

**Produto e negócio:**

- Provedor de pagamento de produção.
- Decisões abertas no design da F8, §13: taxa da plataforma, preço e repasse do fura-fila, custeio do cashback, taxa e destino do saque, saque do QI, política de estorno, prazos de reserva e Pix, tarifa da Stripe.
- Backend real fora de pagamentos: fila em tempo real, posts, vídeo e storage. A F8 entregue é só o recorte de pagamentos.
- Chave de produção do Google Maps (doc mestre, Fase 8); `app.json` traz placeholder e a chave vem do ambiente.
- Lojista sem tela de cadastro de cartão (`c93df9d`).
- Dívidas não fechadas no design da F8, §15.
- Pendência de segurança, ver código e design da F8, §14.

**TODOs no código:**

- 9 `TODO(F8)`, em `components/qi/`, `components/dashboard/EarningsLineChart.tsx`, `lib/qi/routes.ts` e `lib/merchant/merchantKpis.ts`.
- `TODO(F6)` em `app/(merchant)/home/index.tsx:470` e `components/home/StoriesRow.tsx:58`: a F6 já foi concluída, conferir se ainda se aplicam.
- `TODO(F2)` em `app/(merchant)/aqui-agora/index.tsx:162`.
