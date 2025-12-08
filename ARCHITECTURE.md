# Arquitetura do Projeto Wall-to-All

## 📋 Visão Geral

**Wall-to-All** é uma plataforma mobile desenvolvida com React Native e Expo que conecta clientes a prestadores de serviços locais. O aplicativo oferece dois fluxos distintos: um para **Clientes** (busca e agendamento de serviços) e outro para **Lojistas** (gerenciamento de negócio e agenda).

### Objetivo da POC
Demonstração pixel-perfect fiel ao design final do projeto, utilizando autenticação real com Supabase e dados híbridos (mockados + reais) para apresentação ao cliente.

---

## 🛠️ Stack Tecnológico

### Core
- **Framework**: React Native 0.76.9
- **Expo**: ~52.0.0
- **Roteamento**: Expo Router ~4.0.21 (file-based routing)
- **Linguagem**: TypeScript 5.9.2

### Backend & Autenticação
- **Supabase**: @supabase/supabase-js ^2.85.0
  - Autenticação (email/password + Google OAuth)
  - Banco de dados PostgreSQL
  - Storage para imagens

### UI & Estilo
- **Ícones**: 
  - @expo/vector-icons (MaterialIcons) para ícones padrão
  - SVGs customizados do Figma (react-native-svg 15.8.0)
- **Fontes**: 
  - Montserrat (Regular 400, Bold 700)
  - Roboto (Regular 400, Medium 500)
- **Gradientes**: expo-linear-gradient ~14.0.2
- **Safe Area**: react-native-safe-area-context ~4.12.0

### Utilitários
- **Storage**: @react-native-async-storage/async-storage 1.23.1
- **Datas**: date-fns ^4.1.0
- **Imagens**: expo-image-picker ~16.0.0
- **SVG Transformer**: react-native-svg-transformer ^1.5.2

---

## 📁 Estrutura de Pastas

```
wall-to-all/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx              # Root layout com AuthProvider
│   ├── index.tsx                # Tela inicial (redirecionamento)
│   ├── (auth)/                  # Grupo de autenticação
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── user-type-selection.tsx
│   │   ├── client-signup-*.tsx  # Fluxo cadastro cliente
│   │   └── merchant-signup-*.tsx # Fluxo cadastro lojista
│   ├── (client)/                # Fluxo do Cliente
│   │   ├── _layout.tsx          # Tabs: Home, Appointments, Profile, Settings
│   │   ├── home/
│   │   ├── search/
│   │   ├── appointments/
│   │   ├── schedule/            # Fluxo de agendamento
│   │   ├── store/[id].tsx       # Perfil da loja
│   │   ├── services/
│   │   ├── profile/
│   │   └── settings/
│   └── (merchant)/              # Fluxo do Lojista
│       ├── _layout.tsx          # Tabs: Home, Dashboard, Services, Profile, Settings
│       ├── home/
│       ├── dashboard/           # Agenda e agendamentos
│       ├── services/           # Gerenciamento de serviços
│       ├── profile/
│       └── settings/
├── components/                  # Componentes reutilizáveis
│   ├── CustomTabBar.tsx        # TabBar do Cliente
│   ├── MerchantCustomTabBar.tsx # TabBar do Lojista
│   ├── MerchantTopBar.tsx
│   └── ui/                     # Componentes UI base
├── context/                     # Context API
│   └── AuthContext.tsx         # Gerenciamento de autenticação e roles
├── lib/                         # Utilitários e helpers
│   ├── supabase.ts             # Cliente Supabase
│   ├── assets.ts               # Exportação de SVGs do Figma
│   ├── icons.tsx               # Helper de ícones (SVG + MaterialIcons)
│   ├── categories.ts           # Funções de categorias
│   └── utils.ts                # Funções utilitárias
├── assets/                      # Assets estáticos (SVGs, imagens)
└── declarations.d.ts           # TypeScript declarations

```

---

## 🔐 Autenticação e Autorização

### Fluxo de Autenticação

1. **Login/Cadastro** (`app/(auth)/`)
   - Login com email/senha ou Google OAuth
   - Seleção de tipo de usuário (Cliente ou Lojista)
   - Cadastro em etapas conforme tipo de usuário

2. **Context de Autenticação** (`context/AuthContext.tsx`)
   - Gerencia sessão do Supabase
   - Busca `user_type` da tabela `profiles`
   - Redireciona automaticamente baseado no role:
     - `client` → `/(client)/home`
     - `merchant` → `/(merchant)/dashboard`

3. **Proteção de Rotas** (`app/_layout.tsx`)
   - Verifica sessão e redireciona para login se não autenticado
   - Impede acesso cruzado (cliente não acessa rotas de merchant e vice-versa)

### Estrutura de Dados (Supabase)

#### Tabela `profiles`
```sql
- id (uuid, FK para auth.users)
- user_type ('client' | 'merchant')
- full_name (text)
- email (text)
- phone (text)
- avatar_url (text)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Tabela `categories`
```sql
- id (serial)
- name (text)
- created_at (timestamp)
```

---

## 🧭 Navegação

### Sistema de Navegação

O projeto utiliza **Expo Router** com file-based routing, organizado em grupos:

- `(auth)` - Rotas públicas de autenticação
- `(client)` - Rotas protegidas do Cliente
- `(merchant)` - Rotas protegidas do Lojista

### TabBar - Cliente

**Estrutura conforme Figma** (node-id: `577:3622`):

| Ordem | Tab | Ícone | Rota | Status Ativo |
|-------|-----|-------|------|--------------|
| 1 | Busca | `IconSearch` | `home` | Fundo vermelho (#E5102E) |
| 2 | Agendamentos | `IconSchedule` | `appointments` | Cor azul escuro (#000E3D) |
| 3 | Perfil | `IconProfileTabBar` | `profile` | Cor azul escuro (#000E3D) |
| 4 | Configurações | `IconSettings` | `settings` | Cor azul escuro (#000E3D) |

**Observações**:
- A primeira tab (Busca) está ativa quando o usuário está em `home` ou `search`
- Ícone de busca tem tamanho 24px, demais têm 20px
- Altura da TabBar: 72px

### TabBar - Lojista

**Estrutura conforme Figma** (node-id: `461:5843`, `461:7788`):

| Ordem | Tab | Ícone | Rota | Status Ativo |
|-------|-----|-------|------|--------------|
| 1 | Home | `IconHome` | `home` | Cor azul escuro (#000E3D) |
| 2 | Agenda | `IconSchedule` | `dashboard` | Cor azul escuro (#000E3D) |
| 3 | Serviços | `IconBusinessCenter` | `services` | Cor azul escuro (#000E3D) |
| 4 | Perfil | `IconAccount` | `profile` | Fundo vermelho (#E5102E) quando ativo |
| 5 | Configurações | `IconSettings` | `settings` | Fundo vermelho (#E5102E) quando ativo |

**Observações**:
- Todas as tabs têm ícones de 20px
- Perfil e Configurações alternam qual fica com fundo vermelho dependendo da tela
- Altura da TabBar: 72px

### ⚠️ Problemas Identificados na Navegação Atual

1. **Cliente**: A TabBar atual usa `home` como primeira tab, mas o Figma mostra `search` como primeira tab ativa
2. **Lojista**: A TabBar tem 5 tabs incluindo `settings`, mas o Figma mostra que `settings` pode não estar sempre visível na TabBar principal
3. **Inconsistência**: As TabBars não seguem exatamente a ordem e comportamento do Figma

---

## 📱 Fluxos de Usuário

### Fluxo do Cliente

#### 1. Autenticação
```
Login → Seleção de Tipo → Cadastro Cliente (dados pessoais) → Loading → Home
```

#### 2. Busca e Descoberta
```
Home (busca) → Search (resultados) → Store Profile → Agendar
```

#### 3. Agendamento
```
Store Profile → Schedule/Service → Schedule/Date → Schedule/Time → Schedule/Confirm
```

#### 4. Gerenciamento
```
Appointments → Ver detalhes → Cancelar/Reagendar
Profile → Editar perfil → Alterar senha
Settings → FAQ → Termos de uso
```

### Fluxo do Lojista

#### 1. Autenticação
```
Login → Seleção de Tipo → Cadastro Lojista:
  - Dados pessoais
  - Dados do negócio
  - Serviços oferecidos
  → Loading → Dashboard
```

#### 2. Dashboard (Agenda)
```
Dashboard (hoje) → Dashboard/Month (calendário) → Dashboard/Appointment/[id] (detalhes)
```

#### 3. Gerenciamento de Serviços
```
Services → Services/Create → Services/Edit/[id]
```

#### 4. Perfil e Configurações
```
Profile → Profile/Edit → Profile/Password
Settings → Settings/FAQ → Settings/Terms
```

---

## 🎨 Design System

### Cores

| Cor | Hex | Uso |
|-----|-----|-----|
| Primária (Vermelho) | `#E5102E` | Botões principais, TabBar ativa |
| Texto Principal | `#000E3D` | Textos, ícones inativos |
| Superfície Padrão | `#FEFEFE` | Background principal |
| Superfície Secundária | `#E5E5E5` | Bordas, divisores |
| Sombra | `rgba(29, 29, 29, 0.16)` | Elevação de componentes |

### Tipografia

- **Títulos**: Montserrat Bold (700) - 24px
- **Subtítulos**: Montserrat Regular (400) - 20px
- **Corpo**: Roboto Regular (400) - 16px
- **Labels**: Roboto Medium (500) - 15px

### Componentes Base

#### Botões
- **Contained** (`button-contained`): Fundo vermelho, texto branco
- **Outline** (`button-outline`): Borda, texto azul escuro
- **Ghost** (`button-ghost`): Sem fundo, texto azul escuro

#### Inputs
- Altura padrão: 71px (texto simples) / 94px (senha)
- Padding: 16px horizontal
- Border radius: 8px

#### Cards
- **Service Card**: 193x201px (horizontal) / 342x104px (vertical)
- **Store Highlight Card**: 255x349px
- **Appointment Card**: 342x95px

---

## 🗄️ Modelo de Dados

### Supabase Schema (Estimado)

#### `profiles`
```typescript
{
  id: string;              // UUID, FK auth.users
  user_type: 'client' | 'merchant';
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}
```

#### `merchants` (extensão de profiles)
```typescript
{
  id: string;              // FK profiles.id
  business_name: string;
  business_description?: string;
  address?: string;
  cnpj?: string;
  logo_url?: string;
  rating?: number;
  payment_methods: string[]; // ['pix', 'credit_card', 'cash']
  operating_hours: {
    [day: string]: {
      open: string;
      close: string;
      is_open: boolean;
    }
  };
}
```

#### `categories`
```typescript
{
  id: number;
  name: string;
  created_at: string;
}
```

#### `services`
```typescript
{
  id: string;
  merchant_id: string;     // FK merchants.id
  category_id: number;      // FK categories.id
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  images: string[];
  created_at: string;
  updated_at: string;
}
```

#### `appointments`
```typescript
{
  id: string;
  client_id: string;       // FK profiles.id (user_type='client')
  merchant_id: string;      // FK profiles.id (user_type='merchant')
  service_id: string;       // FK services.id
  scheduled_at: string;      // ISO datetime
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_method: 'pix' | 'credit_card' | 'cash';
  client_notes?: string;
  merchant_notes?: string;
  created_at: string;
  updated_at: string;
}
```

#### `reviews`
```typescript
{
  id: string;
  appointment_id: string;  // FK appointments.id
  client_id: string;
  merchant_id: string;
  rating: number;           // 1-5
  comment?: string;
  created_at: string;
}
```

---

## 🗺️ Mapeamento de Telas (Figma → Código)

### Autenticação

| Tela Figma | Node ID | Arquivo Código | Status |
|------------|---------|----------------|--------|
| Login | `398:3772` (lojista)<br>`577:2442` (cliente) | `app/(auth)/login.tsx` | ✅ Implementada |
| Seleção de Tipo | `398:5253`<br>`577:2451` | `app/(auth)/user-type-selection.tsx` | ✅ Implementada |
| Cadastro Cliente - Pessoal | `577:2479` | `app/(auth)/client-signup-personal.tsx` | ✅ Implementada |
| Cadastro Cliente - Loading | `577:2577` | `app/(auth)/client-signup-loading.tsx` | ✅ Implementada |
| Cadastro Lojista - Pessoal | `398:3891` | `app/(auth)/merchant-signup-personal.tsx` | ✅ Implementada |
| Cadastro Lojista - Negócio | `398:5030` | `app/(auth)/merchant-signup-business.tsx` | ✅ Implementada |
| Cadastro Lojista - Serviços | `398:5615` | `app/(auth)/merchant-signup-services.tsx` | ✅ Implementada |
| Cadastro Lojista - Loading | `398:6076` | `app/(auth)/merchant-signup-loading.tsx` | ✅ Implementada |

### Cliente

| Tela Figma | Node ID | Arquivo Código | Status |
|------------|---------|----------------|--------|
| Home | `577:3604`<br>`596:6254`<br>`604:9345` | `app/(client)/home/index.tsx` | 🚧 Parcial |
| Busca | `596:6866` | `app/(client)/search/index.tsx` | 🚧 Parcial |
| Resultados de Busca | `596:7245` | `app/(client)/search/results.tsx` | 🚧 Parcial |
| Perfil da Loja | `577:2582` | `app/(client)/store/[id].tsx` | 🚧 Parcial |
| Agendamento - Serviço | `577:3674` | `app/(client)/schedule/service.tsx` | 🚧 Parcial |
| Agendamento - Data | `577:3736`<br>`604:12145`<br>`585:5872` | `app/(client)/schedule/date.tsx` | 🚧 Parcial |
| Agendamento - Hora | `464:3566`<br>`577:3623` | `app/(client)/schedule/time.tsx` | 🚧 Parcial |
| Agendamento - Confirmação | - | `app/(client)/schedule/confirm.tsx` | ❌ Pendente |
| Meus Agendamentos | - | `app/(client)/appointments/index.tsx` | 🚧 Parcial |
| Perfil | `604:14271` | `app/(client)/profile/index.tsx` | 🚧 Parcial |
| Editar Perfil | `577:2527` | `app/(client)/profile/edit.tsx` | 🚧 Parcial |
| Alterar Senha | `577:2492` | `app/(client)/profile/password.tsx` | ✅ Implementada |
| Configurações | `577:3634` | `app/(client)/settings/index.tsx` | 🚧 Parcial |
| FAQ | `577:3657` | `app/(client)/settings/faq.tsx` | 🚧 Parcial |
| Termos de Uso | `577:3820` | `app/(client)/settings/terms.tsx` | 🚧 Parcial |

### Lojista

| Tela Figma | Node ID | Arquivo Código | Status |
|------------|---------|----------------|--------|
| Home | `403:6289` | `app/(merchant)/home/index.tsx` | 🚧 Parcial |
| Dashboard (Hoje) | `445:3117`<br>`461:9510` | `app/(merchant)/dashboard/index.tsx` | 🚧 Parcial |
| Dashboard (Mês) | `451:3785` | `app/(merchant)/dashboard/month.tsx` | 🚧 Parcial |
| Detalhes do Agendamento | `451:4851`<br>`585:5813` | `app/(merchant)/dashboard/appointment/[id].tsx` | 🚧 Parcial |
| Reagendar Agendamento | `461:7884`<br>`577:3781` | - | ❌ Pendente |
| Modal Reagendar | `461:9368`<br>`577:3800` | - | ❌ Pendente |
| Serviços | `461:11020` | `app/(merchant)/services/index.tsx` | 🚧 Parcial |
| Criar Serviço | `398:5615` | `app/(merchant)/services/create.tsx` | 🚧 Parcial |
| Editar Serviço | `461:11326` | `app/(merchant)/services/edit/[id].tsx` | 🚧 Parcial |
| Perfil | `461:5286` | `app/(merchant)/profile/index.tsx` | 🚧 Parcial |
| Editar Perfil | `461:13158` | `app/(merchant)/profile/edit.tsx` | 🚧 Parcial |
| Alterar Senha | `461:13439` | `app/(merchant)/profile/password.tsx` | ✅ Implementada |
| Configurações | `430:3196` | `app/(merchant)/settings/index.tsx` | 🚧 Parcial |
| FAQ | `472:5607` | `app/(merchant)/settings/faq.tsx` | 🚧 Parcial |
| Termos de Uso | `461:13580` | `app/(merchant)/settings/terms.tsx` | 🚧 Parcial |

**Legenda**:
- ✅ Implementada: Tela completa e funcional
- 🚧 Parcial: Tela existe mas precisa de ajustes/polimento
- ❌ Pendente: Tela não implementada

---

## 🔧 Componentes Principais

### CustomTabBar (`components/CustomTabBar.tsx`)
TabBar customizada para o fluxo do Cliente com 4 tabs.

**Tabs**:
1. Home/Busca (ícone de busca, ativo quando em home ou search)
2. Agendamentos (schedule)
3. Perfil (profiletabbaricon)
4. Configurações (settings)

**Comportamento**:
- Primeira tab fica ativa (fundo vermelho) quando em `home` ou `search`
- Demais tabs ficam ativas com cor azul escuro quando selecionadas

### MerchantCustomTabBar (`components/MerchantCustomTabBar.tsx`)
TabBar customizada para o fluxo do Lojista com 5 tabs.

**Tabs**:
1. Home
2. Dashboard (agenda)
3. Services (serviços)
4. Profile (perfil - pode ter fundo vermelho quando ativo)
5. Settings (configurações - pode ter fundo vermelho quando ativo)

**Comportamento**:
- Profile ou Settings ficam com fundo vermelho quando ativos
- Demais tabs ficam ativas com cor azul escuro

### AuthContext (`context/AuthContext.tsx`)
Gerencia autenticação e roles do usuário.

**Funcionalidades**:
- Inicializa sessão do Supabase
- Busca `user_type` da tabela `profiles`
- Escuta mudanças de autenticação em tempo real
- Fornece `session`, `userRole` e `isLoading` para toda a aplicação

---

## 📊 Integrações Necessárias

### Supabase
- ✅ Autenticação (email/password)
- ⚠️ Google OAuth (configurado mas precisa validação)
- ⚠️ Storage para upload de imagens (logo, fotos de serviços)
- ⚠️ Database queries (CRUD de serviços, agendamentos, etc.)

### APIs Externas (Futuro)
- Pagamentos (PIX, Cartão de Crédito)
- Notificações Push
- Geolocalização (busca por proximidade)

---

## 🚀 Roadmap de Implementação da POC

### Fase 0: Correção de Navegação (CRÍTICO) 🔴

**Objetivo**: Alinhar TabBars exatamente com o Figma

**Tarefas**:
1. Corrigir `CustomTabBar.tsx`:
   - Primeira tab deve ser "Busca" (search), não "Home"
   - Verificar ícones e tamanhos conforme Figma
   - Ajustar comportamento de ativação

2. Corrigir `MerchantCustomTabBar.tsx`:
   - Verificar se todas as 5 tabs devem estar sempre visíveis
   - Ajustar qual tab fica com fundo vermelho (Profile vs Settings)
   - Validar ícones e tamanhos

3. Atualizar layouts:
   - `app/(client)/_layout.tsx`: Garantir que `search` está mapeado corretamente
   - `app/(merchant)/_layout.tsx`: Validar todas as rotas

### Fase 1: Autenticação e Onboarding ✅ (Parcial)

**Status**: Maioria implementada, precisa polimento

**Tarefas**:
- [ ] Validar fluxo completo de cadastro Cliente
- [ ] Validar fluxo completo de cadastro Lojista (3 etapas)
- [ ] Implementar Google OAuth funcional
- [ ] Adicionar validações de formulário
- [ ] Melhorar tratamento de erros

### Fase 2: Fluxo do Cliente 🔴 (Alta Prioridade)

**Tarefas**:
1. **Home/Busca** (`app/(client)/home/index.tsx`):
   - [ ] Barra de busca funcional
   - [ ] Chips de categorias
   - [ ] Cards de lojas em destaque
   - [ ] Carrossel de serviços

2. **Busca** (`app/(client)/search/`):
   - [ ] Autocomplete de serviços
   - [ ] Resultados de busca
   - [ ] Filtros

3. **Perfil da Loja** (`app/(client)/store/[id].tsx`):
   - [ ] Hero com imagem e avatar
   - [ ] Ratings e avaliações
   - [ ] Horários de funcionamento
   - [ ] Métodos de pagamento
   - [ ] Lista de serviços
   - [ ] Botão "Agendar"

4. **Agendamento** (`app/(client)/schedule/`):
   - [ ] Seleção de serviço
   - [ ] Seleção de data (calendário)
   - [ ] Seleção de horário
   - [ ] Confirmação com resumo

5. **Meus Agendamentos** (`app/(client)/appointments/index.tsx`):
   - [ ] Lista de agendamentos
   - [ ] Status (pendente, confirmado, etc.)
   - [ ] Cancelar/Reagendar

### Fase 3: Fluxo do Lojista 🔴 (Alta Prioridade)

**Tarefas**:
1. **Dashboard** (`app/(merchant)/dashboard/`):
   - [ ] Calendário mensal
   - [ ] Lista de agendamentos do dia
   - [ ] Detalhes do agendamento
   - [ ] Ações (confirmar, reagendar, cancelar)

2. **Serviços** (`app/(merchant)/services/`):
   - [ ] Lista de serviços
   - [ ] Criar serviço (formulário completo)
   - [ ] Editar serviço
   - [ ] Deletar serviço
   - [ ] Upload de imagens

3. **Perfil** (`app/(merchant)/profile/`):
   - [ ] Visualização do perfil
   - [ ] Editar dados do negócio
   - [ ] Upload de logo
   - [ ] Configurar horários de funcionamento
   - [ ] Configurar métodos de pagamento

### Fase 4: Integrações e Polimento 🟡

**Tarefas**:
1. **Dados Mockados**:
   - [ ] Criar estrutura de dados mockados para POC
   - [ ] Serviços de exemplo
   - [ ] Lojas de exemplo
   - [ ] Agendamentos de exemplo

2. **Supabase Queries**:
   - [ ] CRUD de serviços
   - [ ] CRUD de agendamentos
   - [ ] Busca de lojas
   - [ ] Upload de imagens

3. **Validações**:
   - [ ] Validação de formulários
   - [ ] Tratamento de erros
   - [ ] Loading states

4. **Pixel-Perfect**:
   - [ ] Ajustar espaçamentos
   - [ ] Validar cores e tipografia
   - [ ] Ajustar tamanhos de componentes
   - [ ] Validar animações e transições

---

## 📝 Checklist de Funcionalidades

### Autenticação ✅
- [x] Login com email/senha
- [ ] Login com Google (configurado, precisa validação)
- [x] Cadastro Cliente
- [x] Cadastro Lojista (3 etapas)
- [x] Logout
- [x] Proteção de rotas

### Cliente
- [ ] Busca de serviços/lojas
- [ ] Visualização de perfil da loja
- [ ] Agendamento completo (serviço → data → hora → confirmação)
- [ ] Lista de agendamentos
- [ ] Cancelar agendamento
- [ ] Reagendar agendamento
- [ ] Editar perfil
- [ ] Alterar senha
- [ ] FAQ
- [ ] Termos de uso

### Lojista
- [ ] Dashboard com calendário
- [ ] Visualizar agendamentos do dia
- [ ] Detalhes do agendamento
- [ ] Confirmar agendamento
- [ ] Reagendar agendamento (sugerir novo horário)
- [ ] Cancelar agendamento
- [ ] Lista de serviços
- [ ] Criar serviço
- [ ] Editar serviço
- [ ] Deletar serviço
- [ ] Upload de imagens (logo, serviços)
- [ ] Editar perfil do negócio
- [ ] Configurar horários
- [ ] Configurar métodos de pagamento
- [ ] Alterar senha
- [ ] FAQ
- [ ] Termos de uso

---

## 🎯 Próximos Passos Imediatos

1. **Corrigir TabBars** conforme especificação do Figma
2. **Documentar** todas as telas pendentes com referências Figma
3. **Implementar** telas críticas do fluxo de agendamento
4. **Configurar** dados mockados estruturados
5. **Validar** integração com Supabase

---

## 📚 Referências

- **Figma Lojista**: https://www.figma.com/design/c1QOl8EocqBiGd6R2NzrFn/Wall-to-all?node-id=461-16428
- **Figma Cliente**: https://www.figma.com/design/c1QOl8EocqBiGd6R2NzrFn/Wall-to-all?node-id=577-2441
- **Expo Router Docs**: https://docs.expo.dev/router/introduction/
- **Supabase Docs**: https://supabase.com/docs

---

**Última atualização**: Janeiro 2025
**Versão**: 1.0.0 (POC)

