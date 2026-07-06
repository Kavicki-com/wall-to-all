# F0 (Fundação) + F1 (Aqui e Agora) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar a fundação compartilhada do novo escopo (libs nativas, camada de serviços mockados, componentes do design system) e a feature Aqui e Agora completa (cliente + lojista) em UI-first com mocks.

**Architecture:** Telas consomem interfaces de serviço (`lib/services/`) via `ServicesProvider`; implementações mock com timers simulam realtime. Rotas novas em `app/(client)/aqui-agora/` e `app/(merchant)/aqui-agora/` como rotas ocultas dos `Tabs` existentes. Visual extraído do Figma (`fileKey c1QOl8EocqBiGd6R2NzrFn`) tela a tela via `get_design_context`.

**Tech Stack:** Expo (dev client) · expo-router · react-native-maps (Google) · expo-camera · expo-video · Supabase (só na F8) · jest + @testing-library/react-native · tokens de `lib/theme.ts`.

**Referência de escopo:** `docs/plans/2026-07-06-novo-escopo-master.md` (decisões, inventário completo, node-ids).

**Convenções que valem para TODAS as tarefas:**
- Typecheck manual: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` (OOM sem isso).
- Nunca hardcodar dado em tela: sempre via serviço mockado.
- Cores/espaçamentos: `lib/theme.ts` (`colors`). Se o Figma trouxer token novo, adicionar ao theme — nunca hex inline.
- Commits sem atribuição de AI.
- Para cada tela: antes de implementar, chamar `mcp__claude_ai_Figma__get_design_context` com o `nodeId` indicado e usar o screenshot como referência de fidelidade.

---

## Fase 0 — Fundação

### Task 1: Instalar libs nativas e configurar plugins

**Files:**
- Modify: `package.json` (deps)
- Modify: `app.json` (plugins + android.config)

**Step 1: Instalar com versões compatíveis com o SDK**

```bash
npx expo install react-native-maps expo-camera expo-video
```

**Step 2: Configurar plugins no `app.json`**

Adicionar ao array `expo.plugins` (manter os existentes):

```json
[
  "expo-video",
  [
    "expo-camera",
    {
      "cameraPermission": "O app precisa da câmera para gravar vídeos e stories do seu negócio.",
      "microphonePermission": "O app precisa do microfone para gravar o áudio dos vídeos."
    }
  ]
]
```

Adicionar em `expo.android` (a key vem do console do Google Cloud — pedir ao Gabriel se ainda não existir; usar restrição por package name):

```json
"config": { "googleMaps": { "apiKey": "<GOOGLE_MAPS_ANDROID_API_KEY>" } }
```

> ⚠️ Não commitar a key crua se o repo for público; preferir `app.config.js` lendo de `process.env.GOOGLE_MAPS_ANDROID_API_KEY` (dotenv já é devDependency e `app.config.js` já existe).

**Step 3: Rebuild do dev client**

```bash
npx expo run:android
```
Expected: build conclui e o app abre no device/emulador. (Longo — ~10-20min; rodar uma vez só.)

**Step 4: Smoke test manual** — app abre, telas existentes funcionam.

**Step 5: Commit**

```bash
git add package.json package-lock.json app.json app.config.js
git commit -m "chore: add react-native-maps, expo-camera and expo-video for new scope"
```

### Task 2: Mocks de Jest para as libs nativas

**Files:**
- Modify: `jest.config.js` (se necessário `transformIgnorePatterns`)
- Create: `__mocks__/react-native-maps.tsx`

**Step 1: Criar mock de react-native-maps** (evita crash de native module nos testes de tela):

```tsx
import React from 'react';
import { View } from 'react-native';

const MockMapView = (props: Record<string, unknown>) => <View testID="map-view" {...props} />;
const MockMarker = (props: Record<string, unknown>) => <View testID="map-marker" {...props} />;

export default MockMapView;
export { MockMarker as Marker, MockMapView as MapView };
export const PROVIDER_GOOGLE = 'google';
```

**Step 2: Rodar a suíte existente para garantir que nada quebrou**

Run: `npm test`
Expected: todos os testes existentes PASS.

**Step 3: Commit**

```bash
git add __mocks__/react-native-maps.tsx jest.config.js
git commit -m "test: jest mock for react-native-maps"
```

### Task 3: Tipos de domínio da fila e carteira

**Files:**
- Create: `lib/services/types.ts`
- Test: `__tests__/services-types.test.ts` (só compile-time; teste smoke)

**Step 1: Escrever os tipos** (`lib/services/types.ts`):

```ts
// ── Fila (Aqui e Agora) ────────────────────────────────────
export type QueueStatus = 'inactive' | 'active' | 'paused' | 'full';
export type TicketStatus = 'waiting' | 'called' | 'served' | 'no_show' | 'left';

export interface QueueTicket {
  id: string;
  number: number;
  customerName: string;
  joinedAt: string; // ISO 8601
  isFuraFila: boolean;
  status: TicketStatus;
  positionInLine: number; // 0 = sendo atendido
  estimatedWaitMinutes: number;
}

export interface QueueSettings {
  furaFilaEnabled: boolean;
  furaFilaPriceCents: number;
  maxSize: number;
  avgServiceMinutes: number;
}

export interface QueueInfo {
  merchantId: string;
  merchantName: string;
  status: QueueStatus;
  ticketsWaiting: number;
  estimatedWaitMinutes: number;
  nowServingNumber: number | null;
  settings: QueueSettings;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface NearbyMerchant {
  id: string;
  name: string;
  category: string;
  coordinate: LatLng;
  distanceKm: number;
  rating: number;
  queue: QueueInfo;
}

export interface QueueService {
  // cliente
  getNearbyMerchants(center: LatLng): Promise<NearbyMerchant[]>;
  getQueueInfo(merchantId: string): Promise<QueueInfo>;
  joinQueue(merchantId: string, opts?: { furaFila?: boolean }): Promise<QueueTicket>;
  leaveQueue(ticketId: string): Promise<void>;
  getMyTicket(): Promise<QueueTicket | null>;
  subscribeToTicket(ticketId: string, cb: (ticket: QueueTicket) => void): () => void;
  // lojista
  getMerchantQueue(): Promise<QueueTicket[]>;
  subscribeToMerchantQueue(cb: (tickets: QueueTicket[]) => void): () => void;
  setQueueStatus(status: QueueStatus): Promise<void>;
  callNext(): Promise<QueueTicket | null>;
  resolveTicket(ticketId: string, outcome: 'served' | 'no_show'): Promise<void>;
  getSettings(): Promise<QueueSettings>;
  updateSettings(settings: Partial<QueueSettings>): Promise<QueueSettings>;
}

// ── Carteira (subset usado na F1; completa na F3) ──────────
export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex';

export interface PaymentCard {
  id: string;
  brand: CardBrand;
  last4: string;
  holderName: string;
  expiry: string; // MM/YY
  isDefault: boolean;
}

export interface PixCharge {
  qrCode: string;
  copyPasteCode: string;
  amountCents: number;
  expiresAt: string; // ISO 8601
}

export interface WalletService {
  getCards(): Promise<PaymentCard[]>;
  createPixCharge(amountCents: number, description: string): Promise<PixCharge>;
  payWithCard(cardId: string, amountCents: number, description: string): Promise<{ status: 'approved' | 'declined' }>;
}
```

**Step 2: Teste smoke** (`__tests__/services-types.test.ts`):

```ts
import type { QueueService, WalletService } from '../lib/services/types';

describe('service types', () => {
  it('are importable (type-only smoke test)', () => {
    const q: Partial<QueueService> = {};
    const w: Partial<WalletService> = {};
    expect(q).toBeDefined();
    expect(w).toBeDefined();
  });
});
```

**Step 3:** Run: `npm test -- __tests__/services-types.test.ts` → PASS.

**Step 4: Commit** — `git commit -m "feat(services): domain types for queue and wallet"`

### Task 4: MockQueueService

**Files:**
- Create: `lib/services/mock/mockQueueService.ts`
- Create: `lib/services/mock/queueFixtures.ts` (merchants/tickets fake)
- Test: `__tests__/mock-queue-service.test.ts`

**Step 1: Teste que falha primeiro** (comportamentos-chave):

```ts
import { MockQueueService } from '../lib/services/mock/mockQueueService';

describe('MockQueueService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns nearby merchants with queue info', async () => {
    const svc = new MockQueueService();
    const merchants = await svc.getNearbyMerchants({ latitude: -23.5, longitude: -46.6 });
    expect(merchants.length).toBeGreaterThan(0);
    expect(merchants[0].queue.status).toBeDefined();
  });

  it('joinQueue returns ticket and getMyTicket finds it', async () => {
    const svc = new MockQueueService();
    const ticket = await svc.joinQueue('m1');
    expect(ticket.status).toBe('waiting');
    expect(await svc.getMyTicket()).toEqual(ticket);
  });

  it('fura-fila ticket enters ahead of regular tickets', async () => {
    const svc = new MockQueueService();
    const ticket = await svc.joinQueue('m1', { furaFila: true });
    expect(ticket.isFuraFila).toBe(true);
    expect(ticket.positionInLine).toBeLessThanOrEqual(1);
  });

  it('simulates queue advancing over time via subscribeToTicket', async () => {
    const svc = new MockQueueService({ tickIntervalMs: 1000 });
    const ticket = await svc.joinQueue('m1');
    const updates: number[] = [];
    svc.subscribeToTicket(ticket.id, (t) => updates.push(t.positionInLine));
    jest.advanceTimersByTime(3000);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[updates.length - 1]).toBeLessThan(ticket.positionInLine);
  });

  it('merchant can call next and resolve tickets', async () => {
    const svc = new MockQueueService();
    await svc.setQueueStatus('active');
    const next = await svc.callNext();
    expect(next?.status).toBe('called');
    await svc.resolveTicket(next!.id, 'served');
    const queue = await svc.getMerchantQueue();
    expect(queue.find((t) => t.id === next!.id)).toBeUndefined();
  });
});
```

**Step 2:** Run: `npm test -- __tests__/mock-queue-service.test.ts` → FAIL (module não existe).

**Step 3: Implementar** `MockQueueService`:
- Fixtures: ~6 merchants (coordenadas em São Paulo, categorias variadas, filas em estados diversos: active/full/inactive) em `queueFixtures.ts`.
- Fila interna em memória (`QueueTicket[]` pré-populada com ~5 tickets waiting).
- `joinQueue`: fura-fila insere na posição 1 (atrás só do atendido); normal no fim.
- Timer (`setInterval` com `tickIntervalMs`, default 8000): a cada tick, avança a fila (primeiro `waiting` → `called`, decrementa `positionInLine` dos demais) e notifica subscribers.
- `subscribeTo*` retornam função de unsubscribe; `dispose()` limpa o interval.
- Latência simulada: `await delay(300)` nas operações (constante exportada para os testes zerarem via fake timers).

**Step 4:** Run: `npm test -- __tests__/mock-queue-service.test.ts` → PASS.

**Step 5: Commit** — `git commit -m "feat(services): mock queue service with simulated realtime"`

### Task 5: MockWalletService

**Files:**
- Create: `lib/services/mock/mockWalletService.ts`
- Test: `__tests__/mock-wallet-service.test.ts`

**Step 1: Teste que falha:**

```ts
import { MockWalletService } from '../lib/services/mock/mockWalletService';

describe('MockWalletService', () => {
  it('returns mock cards with a default card', async () => {
    const svc = new MockWalletService();
    const cards = await svc.getCards();
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.filter((c) => c.isDefault)).toHaveLength(1);
  });

  it('creates a pix charge with copy-paste code and expiry', async () => {
    const svc = new MockWalletService();
    const charge = await svc.createPixCharge(1500, 'Fura fila — Barbearia X');
    expect(charge.copyPasteCode).toMatch(/^000201/); // formato EMV do BR Code
    expect(new Date(charge.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('approves card payment for known card', async () => {
    const svc = new MockWalletService();
    const [card] = await svc.getCards();
    const result = await svc.payWithCard(card.id, 1500, 'Fura fila');
    expect(result.status).toBe('approved');
  });
});
```

**Step 2:** Run → FAIL. **Step 3:** Implementar (2 cartões fixos visa/mastercard, BR Code fake estático prefixado `000201`, expiração +15min). **Step 4:** Run → PASS.

**Step 5: Commit** — `git commit -m "feat(services): mock wallet service (cards + pix charge)"`

### Task 6: ServicesProvider (context)

**Files:**
- Create: `context/ServicesContext.tsx`
- Test: `__tests__/services-context.test.tsx`

**Step 1: Teste que falha:**

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ServicesProvider, useServices } from '../context/ServicesContext';

const Probe = () => {
  const { queue, wallet } = useServices();
  return <Text>{queue && wallet ? 'ok' : 'missing'}</Text>;
};

describe('ServicesProvider', () => {
  it('provides queue and wallet services', () => {
    const { getByText } = render(
      <ServicesProvider>
        <Probe />
      </ServicesProvider>
    );
    expect(getByText('ok')).toBeTruthy();
  });

  it('useServices throws outside provider', () => {
    const bad = () => render(<Probe />);
    expect(bad).toThrow(/ServicesProvider/);
  });
});
```

**Step 2:** Run → FAIL. **Step 3:** Implementar: context com `{ queue: QueueService; wallet: WalletService }`, instâncias singleton de `MockQueueService`/`MockWalletService` criadas com `useRef`, `dispose` no unmount. Exportar hooks `useServices`, `useQueueService`, `useWalletService`. **Step 4:** Run → PASS.

**Step 5:** Montar o provider em `app/_layout.tsx` envolvendo o conteúdo existente (mesmo nível dos outros providers globais). Rodar `npm test` completo → PASS.

**Step 6: Commit** — `git commit -m "feat(services): ServicesProvider wiring mock services into the app"`

### Task 7: Componente Toggle

**Files:**
- Create: `components/ui/Toggle.tsx` · Test: `__tests__/toggle.test.tsx`

**Step 0:** `get_design_context` nodeId `2560:5009` (estados on/off, cores, tamanho).

**Step 1: Teste que falha:**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Toggle } from '../components/ui/Toggle';

describe('Toggle', () => {
  it('calls onValueChange with the opposite value when pressed', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(<Toggle value={false} onValueChange={onValueChange} />);
    fireEvent.press(getByRole('switch'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('exposes accessibility state', () => {
    const { getByRole } = render(<Toggle value onValueChange={jest.fn()} />);
    expect(getByRole('switch').props.accessibilityState.checked).toBe(true);
  });
});
```

**Steps 2-4:** FAIL → implementar (Pressable + Animated thumb, cores do Figma via theme, `accessibilityRole="switch"`) → PASS.

**Step 5: Commit** — `git commit -m "feat(ui): Toggle component per new design"`

### Task 8: Componente Slider

**Files:**
- Create: `components/ui/Slider.tsx` · Test: `__tests__/slider.test.tsx`

**Step 0:** `get_design_context` nodeId `2586:5081`.

**Steps 1-4 (mesmo ciclo TDD):** props `{ value, min, max, step?, onValueChange, label? }`; gesto horizontal via `react-native-gesture-handler` (já instalada); testes: renderiza valor, `accessibilityRole="adjustable"`, `accessibilityActions` increment/decrement chamam `onValueChange`.

**Step 5: Commit** — `git commit -m "feat(ui): Slider component per new design"`

### Task 9: TopBar nova

**Files:**
- Create: `components/layout/TopBar.tsx` · Test: `__tests__/top-bar.test.tsx`

**Step 0:** `get_design_context` nodeId `2715:3617` (variantes: título, ação esquerda voltar, ações direita).

**Steps 1-4:** TDD. Props `{ title?, onBack?, rightActions?: ReactNode, variant?: 'light' | 'brand' }`. Testes: título renderiza; `onBack` chamado no press do botão voltar; sem `onBack` não renderiza o botão.

**Step 5: Commit** — `git commit -m "feat(layout): new TopBar component"`

### Task 10: Bottom-nav nova (evolução das tab bars)

**Files:**
- Modify: `components/CustomTabBar.tsx` e `components/MerchantCustomTabBar.tsx`
- Test: `__tests__/custom-tab-bar.test.tsx` (novo)

**Step 0:** `get_design_context` nodeId `2715:3680` (bottom-nav library). Comparar com as tab bars atuais: o design novo inclui entrada para **Aqui e Agora** (ícone `fura-fila-icon`/mapa) nos dois lados.

**Steps 1-4:** TDD. Atualizar visual (ícones, item ativo, FAB central se houver) preservando o contrato `BottomTabBarProps`. Teste: renderiza um item por rota visível; item ativo tem `accessibilityState.selected`.

**Step 5:** Rodar suíte inteira (`npm test`) — telas existentes usam essas tab bars.

**Step 6: Commit** — `git commit -m "feat(nav): update client and merchant tab bars to new design"`

### Task 11: Drawer

**Files:**
- Create: `components/layout/AppDrawer.tsx` · Test: `__tests__/app-drawer.test.tsx`

**Step 0:** `get_design_context` nodeIds `2643:8225` (cliente) e `2567:4975` (lojista) — provável mesmo componente com listas de itens diferentes.

**Steps 1-4:** TDD. Props `{ visible, onClose, items: DrawerItem[], header?: ReactNode }` com `DrawerItem = { icon, label, route?, onPress?, badge? }`. Testes: itens renderizam; press navega/chama onPress; onClose no overlay.

**Step 5: Commit** — `git commit -m "feat(layout): AppDrawer component for client and merchant"`

### Task 12: Componentes de pagamento

**Files:**
- Create: `components/payment/CreditCard.tsx` (nodeId `2643:8859`)
- Create: `components/payment/PaymentCardRow.tsx` (nodeId `2657:21265`)
- Create: `components/payment/CardBrandFlag.tsx` (nodeId `2655:21161`)
- Create: `components/payment/CardsStack.tsx` (nodeId `2663:6979`)
- Test: `__tests__/payment-components.test.tsx`

**Step 0:** `get_design_context` dos 4 nodes.

**Steps 1-4:** TDD por componente (um ciclo cada, na ordem CardBrandFlag → PaymentCardRow → CreditCard → CardsStack, pois um usa o outro):
- `CardBrandFlag`: `{ brand: CardBrand }` → renderiza o SVG da bandeira (assets exportados do Figma via `download_assets` se houver).
- `PaymentCardRow`: `{ card: PaymentCard, selected?, onPress? }` → linha selecionável (usada no card-selection da F5 também — DRY).
- `CreditCard`: `{ card: PaymentCard }` → cartão visual grande (gradiente conforme Figma).
- `CardsStack`: `{ cards: PaymentCard[], onSelect? }` → pilha com cartão ativo à frente.
- Testes: last4 e holder renderizam; onPress/onSelect disparam com o card certo; flag certa por brand.

**Step 5: Commit** — `git commit -m "feat(payment): CreditCard, PaymentCardRow, CardBrandFlag and CardsStack components"`

### Task 13: Ícone fura-fila

**Files:**
- Create: `components/icons/FuraFilaIcon.tsx` · cobertura via testes das telas que o usam

**Step 0:** `get_design_context`/`download_assets` nodeId `2596:5943` → exportar SVG.

**Step 1:** Componente com `react-native-svg` seguindo padrão de `lib/icons.tsx`/`components/icons`; props `{ size?, color? }`.

**Step 2:** `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` → sem erros.

**Step 3: Commit** — `git commit -m "feat(icons): fura-fila icon"`

---

## Fase 1 — Aqui e Agora · Cliente

> Fluxo: map-search → perfil do lojista → (entrar na fila | fura-fila → pagamento) → lista de espera → senha ativada.

### Task 14: Tela map-search (`aqui-agora/index`)

**Files:**
- Create: `app/(client)/aqui-agora/index.tsx`
- Create: `components/aqui-agora/ResultsSheet.tsx`
- Test: `__tests__/aqui-agora-map-search.test.tsx`

**Step 0:** `get_design_context` nodeId `2715:3575` 🆕 (contém `map-area 🆕`, `results-sheet 🆕`, `Search bar`). Screenshot para fidelidade.

**Step 1: Teste que falha:**

```tsx
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
// mock expo-router: useRouter().push registrado em jest.fn()
// render com ServicesProvider (MockQueueService com fixtures)
import MapSearchScreen from '../app/(client)/aqui-agora/index';

describe('AquiAgora map search', () => {
  it('renders the map and lists nearby merchants in the results sheet', async () => {
    const { getByTestId, findByText } = renderWithProviders(<MapSearchScreen />);
    expect(getByTestId('map-view')).toBeTruthy();
    await findByText(/Barbearia/); // fixture merchant
  });

  it('navigates to merchant profile when a result is pressed', async () => {
    const { findByText } = renderWithProviders(<MapSearchScreen />);
    fireEvent.press(await findByText(/Barbearia/));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/aqui-agora/merchant/'));
  });

  it('filters results by search text', async () => {
    const { getByPlaceholderText, queryByText, findByText } = renderWithProviders(<MapSearchScreen />);
    await findByText(/Barbearia/);
    fireEvent.changeText(getByPlaceholderText(/buscar/i), 'pizza');
    await waitFor(() => expect(queryByText(/Barbearia/)).toBeNull());
  });
});
```

Criar helper `renderWithProviders` em `__tests__/test-utils.tsx` (ServicesProvider + mock de router) — reutilizado por todas as telas da fase.

**Step 2:** Run → FAIL. **Step 3:** Implementar: `MapView` (PROVIDER_GOOGLE) com `Marker` por merchant (pin com estado da fila), `SearchBar` reutilizando `components/SearchBar.tsx` se compatível com o Figma, `ResultsSheet` como bottom sheet com lista. Dados via `useQueueService().getNearbyMerchants()`. **Step 4:** Run → PASS.

**Step 5:** Registrar rota oculta em `app/(client)/_layout.tsx`:

```tsx
<Tabs.Screen name="aqui-agora/index" options={{ tabBarButton: () => null }} />
```
(Se o bottom-nav novo tiver item dedicado — Task 10 — usar entrada visível com `title: 'Aqui e Agora'`.)

**Step 6:** Fidelidade: comparar com screenshot do node `2715:3575`; ajustar.

**Step 7: Commit** — `git commit -m "feat(client): aqui e agora map search screen"`

### Task 15: Perfil do lojista (`aqui-agora/merchant/[id]`)

**Files:**
- Create: `app/(client)/aqui-agora/merchant/[id].tsx`
- Test: `__tests__/aqui-agora-merchant-profile.test.tsx`

**Step 0:** `get_design_context` nodeId `2643:8289`.

**Steps 1-4 (TDD):** testes: nome/categoria/rating do merchant renderizam (via `getQueueInfo`); estado da fila e espera estimada visíveis; CTA "Entrar na fila" chama `joinQueue` e navega para waiting-list; CTA fura-fila (visível só se `settings.furaFilaEnabled`) navega para fura-fila-selection.

**Step 5:** Registrar rota oculta no layout. **Step 6:** Fidelidade vs screenshot.

**Step 7: Commit** — `git commit -m "feat(client): merchant profile view for aqui e agora"`

### Task 16: Seleção fura-fila (`aqui-agora/fura-fila`)

**Files:**
- Create: `app/(client)/aqui-agora/fura-fila.tsx`
- Test: `__tests__/aqui-agora-fura-fila.test.tsx`

**Step 0:** `get_design_context` nodeId `2513:538` + Modal `2659:6381`.

**Steps 1-4 (TDD):** preço vindo de `settings.furaFilaPriceCents` (formatar com `lib/formatters.ts`); escolha do método (Pix | cartão) abre o bottom-sheet correspondente (Task 17); modal de confirmação conforme Figma.

**Step 5:** Rota oculta + fidelidade. **Step 6: Commit** — `git commit -m "feat(client): fura-fila selection screen"`

### Task 17: Bottom-sheets de pagamento (Pix e cartão)

**Files:**
- Create: `components/payment/PaymentPixBottomSheet.tsx` (nodeId `2663:7091` — versão nova; ignorar `2643:20347`)
- Create: `components/payment/PaymentCardBottomSheet.tsx` (nodeId `2643:20390`)
- Test: `__tests__/payment-bottom-sheets.test.tsx`

**Step 0:** `get_design_context` dos 2 nodes.

**Steps 1-4 (TDD):**
- Pix: `{ visible, amountCents, description, onSuccess, onClose }` → chama `wallet.createPixCharge`, mostra QR + copia-e-cola (usar `expo-clipboard` já instalado); botão "copiar código" copia `copyPasteCode`; teste com spy no clipboard.
- Cartão: mesma API + lista de cartões (`wallet.getCards` + `PaymentCardRow` da Task 12); pagar chama `payWithCard` e dispara `onSuccess` quando `approved`.
- Após `onSuccess` no fluxo fura-fila: `joinQueue(merchantId, { furaFila: true })` e navegar para a senha (Task 19).

**Step 5: Commit** — `git commit -m "feat(payment): pix and card payment bottom sheets (mock)"`

### Task 18: Lista de espera (`aqui-agora/waiting-list`)

**Files:**
- Create: `app/(client)/aqui-agora/waiting-list.tsx`
- Test: `__tests__/aqui-agora-waiting-list.test.tsx`

**Step 0:** `get_design_context` nodeId `2496:313`.

**Steps 1-4 (TDD):** posição atual e espera estimada do ticket (via `getMyTicket` + `subscribeToTicket`); teste com fake timers: posição atualiza quando o mock avança a fila; botão "Sair da fila" chama `leaveQueue` + modal de confirmação; quando `status === 'called'` navega para a tela de senha.

**Step 5:** Rota oculta + fidelidade. **Step 6: Commit** — `git commit -m "feat(client): waiting list screen with live position updates"`

### Task 19: Senha — fura fila ativado (`aqui-agora/senha`)

**Files:**
- Create: `app/(client)/aqui-agora/senha.tsx`
- Test: `__tests__/aqui-agora-senha.test.tsx`

**Step 0:** `get_design_context` nodeId `2643:20265`.

**Steps 1-4 (TDD):** número da senha em destaque; badge fura-fila quando `isFuraFila`; "agora atendendo" (nowServingNumber) atualiza via subscription; estado `called` muda o visual conforme Figma.

**Step 5:** Rota oculta + fidelidade. **Step 6: Commit** — `git commit -m "feat(client): ticket screen with fura-fila state"`

---

## Fase 1 — Aqui e Agora · Lojista

### Task 20: Tela principal (`aqui-agora/index` — inactive/active)

**Files:**
- Create: `app/(merchant)/aqui-agora/index.tsx`
- Test: `__tests__/merchant-aqui-agora.test.tsx`

**Step 0:** `get_design_context` nodeIds `2495:254` (inactive) e `2715:3616` 🆕 (active — fonte da verdade para o estado ativo).

**Steps 1-4 (TDD):** uma rota, dois estados condicionados a `QueueInfo.status`:
- inactive → CTA "Ativar" chama `setQueueStatus('active')` e re-renderiza para o estado ativo;
- active → resumo da fila (aguardando, atendendo, espera média), acesso à gestão (Task 21) e settings (Task 22);
- toggle de pausa usa o `Toggle` da Task 7.

**Step 5:** Registrar rota em `app/(merchant)/_layout.tsx` (visível se o bottom-nav novo tiver o item; senão oculta). **Step 6:** Fidelidade (2 screenshots).

**Step 7: Commit** — `git commit -m "feat(merchant): aqui e agora activation screen with active state"`

### Task 21: Gestão de fila (`aqui-agora/fila`)

**Files:**
- Create: `app/(merchant)/aqui-agora/fila.tsx`
- Create: `components/aqui-agora/TicketRow.tsx`
- Test: `__tests__/merchant-fila-management.test.tsx`

**Step 0:** `get_design_context` nodeIds `2590:5155` (normal) e `2596:5847` (fila cheia).

**Steps 1-4 (TDD):** lista de tickets via `subscribeToMerchantQueue` (fura-fila destacados); "Chamar próximo" chama `callNext` e a lista reflete; ações por ticket (`resolveTicket` served/no_show); estado cheio (`status === 'full'`) mostra o banner/estado do Figma; fake timers para o realtime.

**Step 5:** Rota oculta + fidelidade (2 estados). **Step 6: Commit** — `git commit -m "feat(merchant): queue management screen"`

### Task 22: Settings do Aqui e Agora (`aqui-agora/settings`)

**Files:**
- Create: `app/(merchant)/aqui-agora/settings.tsx`
- Test: `__tests__/merchant-aqui-agora-settings.test.tsx`

**Step 0:** `get_design_context` nodeId `2509:458`.

**Steps 1-4 (TDD):** carrega `getSettings`; toggle fura-fila (Task 7), preço (input com formatação de moeda), tamanho máximo (Slider da Task 8 se o Figma usar); salvar chama `updateSettings` e mostra Toast (padrão `components/ui/ToastProvider`).

**Step 5:** Rota oculta + fidelidade. **Step 6: Commit** — `git commit -m "feat(merchant): aqui e agora settings screen"`

### Task 23: Request bottom-sheet (lojista)

**Files:**
- Create: `components/aqui-agora/RequestBottomSheet.tsx`
- Test: `__tests__/merchant-request-bottom-sheet.test.tsx`

**Step 0:** `get_design_context` nodeId `2511:486`.

**Steps 1-4 (TDD):** sheet exibindo novo cliente na fila (nome, fura-fila ou não) com aceitar/recusar → callbacks; integrar na tela principal (Task 20) disparando quando um ticket novo chega na subscription.

**Step 5: Commit** — `git commit -m "feat(merchant): incoming queue request bottom sheet"`

### Task 24: Verificação final da fase

**Step 1:** Suíte completa: `npm test` → PASS.
**Step 2:** `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` e `npm run lint` → limpos.
**Step 3:** Rodar o app (`npx expo start`) e percorrer os dois fluxos ponta a ponta (cliente: mapa → perfil → fura-fila → pagamento mock → senha; lojista: ativar → gerenciar → settings).
**Step 4:** Revisão de fidelidade final: screenshot do Figma vs app para cada tela 🆕 (`2715:3575`, `2715:3616`).
**Step 5:** Atualizar `docs/plans/2026-07-06-novo-escopo-master.md` §7 marcando F0/F1 como concluídas.
**Step 6: Commit** — `git commit -m "docs: mark F0/F1 done in new scope master plan"`
