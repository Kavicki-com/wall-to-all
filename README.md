# Wall-to-All

Plataforma mobile desenvolvida com React Native e Expo que conecta clientes a prestadores de serviços locais.

## 📋 Visão Geral

O **Wall-to-All** é uma aplicação mobile que oferece dois fluxos distintos:

- **Clientes**: Busca, visualização e agendamento de serviços com prestadores locais
- **Lojistas**: Gerenciamento completo de negócio, serviços, agenda e agendamentos

A aplicação foi desenvolvida seguindo fielmente o design do Figma, utilizando autenticação real com Supabase e uma arquitetura escalável baseada em Expo Router.

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
  - Real-time subscriptions

### UI & Estilo
- **Ícones**: 
  - @expo/vector-icons (MaterialIcons)
  - SVGs customizados do Figma (react-native-svg 15.8.0)
- **Fontes**: 
  - Montserrat (Regular 400, Bold 700)
  - Roboto (Regular 400, Medium 500)
- **Gradientes**: expo-linear-gradient ~14.0.2
- **Estilos**: 100% StyleSheet.create() (pixel-perfect do Figma)

### Utilitários
- **Storage**: @react-native-async-storage/async-storage 1.23.1
- **Datas**: date-fns ^4.1.0
- **Imagens**: expo-image-picker ~16.0.0
- **SVG Transformer**: react-native-svg-transformer ^1.5.2

## 📦 Pré-requisitos

- **Node.js**: 18+ 
- **npm** ou **yarn**
- **Expo CLI**: `npm install -g expo-cli` (opcional, já incluído no projeto)
- **Conta no Supabase**: Para backend e autenticação
- **Expo Go** (opcional): Para testar no dispositivo físico

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd wall-to-all
```

### 2. Instale as dependências

```bash
npm install
# ou
yarn install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**Onde encontrar as credenciais:**
1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie a **URL** e a **anon/public key**

**Nota**: O projeto possui valores padrão configurados em `lib/supabase.ts`, mas é recomendado usar variáveis de ambiente para produção.

### 4. Execute o projeto

```bash
npm start
# ou
yarn start
```

Depois, escaneie o QR code com:
- **iOS**: Câmera nativa ou Expo Go
- **Android**: Expo Go app

Ou execute diretamente:
```bash
npm run android  # Android
npm run ios      # iOS (requer macOS)
npm run web      # Web
```

## 📁 Estrutura do Projeto

```
wall-to-all/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx              # Root layout com AuthProvider
│   ├── index.tsx                # Tela inicial (redirecionamento)
│   ├── (auth)/                  # Grupo de autenticação
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── user-type-selection.tsx
│   │   ├── client-signup-*.tsx  # Fluxo cadastro cliente
│   │   └── merchant-signup-*.tsx # Fluxo cadastro lojista
│   ├── (client)/                # Fluxo do Cliente
│   │   ├── home/                # Tela inicial com busca
│   │   ├── search/              # Busca e resultados
│   │   ├── appointments/        # Meus agendamentos
│   │   ├── schedule/            # Fluxo de agendamento
│   │   ├── store/[id].tsx       # Perfil da loja
│   │   ├── services/            # Serviços salvos
│   │   ├── profile/              # Perfil do cliente
│   │   └── settings/            # Configurações
│   └── (merchant)/              # Fluxo do Lojista
│       ├── home/                # Home do lojista
│       ├── dashboard/           # Agenda e agendamentos
│       ├── services/            # Gerenciamento de serviços
│       ├── profile/             # Perfil do lojista
│       └── settings/            # Configurações
├── components/                  # Componentes reutilizáveis
│   ├── CustomTabBar.tsx        # TabBar do Cliente
│   ├── MerchantCustomTabBar.tsx # TabBar do Lojista
│   ├── MerchantTopBar.tsx
│   ├── AppointmentSuccessModal.tsx
│   └── ui/                     # Componentes UI base
├── context/                     # Context API
│   └── AuthContext.tsx         # Gerenciamento de autenticação
├── lib/                         # Utilitários e helpers
│   ├── supabase.ts             # Cliente Supabase
│   ├── assets.ts               # Exportação de SVGs
│   ├── icons.tsx               # Helper de ícones
│   ├── categories.ts           # Funções de categorias
│   ├── categoryUtils.ts
│   ├── utils.ts                # Funções utilitárias
│   └── workDaysUtils.ts        # Utilitários de dias de trabalho
├── assets/                      # Assets estáticos (SVGs, imagens)
├── supabase/                    # Scripts SQL do Supabase
├── docs/                        # Documentação
│   ├── migrations/             # Histórico de migrações
│   └── history/                # Histórico de mudanças
└── declarations.d.ts           # TypeScript declarations
```

## 🔐 Autenticação

O projeto utiliza Supabase para autenticação e gerenciamento de usuários:

### Métodos de Autenticação

- **Email/Senha**: Login tradicional com validação
- **Google OAuth**: Login com Google (configurado, requer validação)
- **Roles**: Sistema de roles (`client` ou `merchant`) definido no cadastro

### Fluxo de Autenticação

1. **Login/Cadastro** → Seleção de tipo de usuário
2. **Cadastro em etapas** conforme tipo:
   - **Cliente**: Dados pessoais → Endereço → Loading → Home
   - **Lojista**: Dados pessoais → Dados do negócio → Serviços → Endereço → Loading → Dashboard
3. **Redirecionamento automático** baseado no `user_type` da tabela `profiles`

### Estrutura de Dados (Supabase)

O projeto espera as seguintes tabelas no Supabase:

- **`profiles`**: Perfis de usuários (client/merchant)
  - `id` (UUID, FK para auth.users)
  - `user_type` ('client' | 'merchant')
  - `full_name`, `email`, `phone`, `avatar_url`
- **`categories`**: Categorias de serviços
- **`services`**: Serviços oferecidos pelos lojistas
- **`appointments`**: Agendamentos
- **`reviews`**: Avaliações

Veja `ARCHITECTURE.md` para mais detalhes sobre o schema completo.

### Proteção de Rotas

- Rotas protegidas verificam autenticação via `AuthContext`
- Impede acesso cruzado (cliente não acessa rotas de merchant e vice-versa)
- Redirecionamento automático para login se não autenticado

## 🎨 Design System

O projeto segue fielmente o design do Figma:

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

- **Botões**: Contained (fundo vermelho), Outline (borda), Ghost (sem fundo)
- **Inputs**: Altura padrão 71px (texto) / 94px (senha), border-radius 8px
- **Cards**: Dimensões específicas conforme design (Service Card, Store Card, etc.)

## 📱 Scripts Disponíveis

```bash
# Iniciar servidor de desenvolvimento
npm start

# Executar no Android
npm run android

# Executar no iOS (requer macOS)
npm run ios

# Executar na web
npm run web
```

## 📚 Documentação Adicional

- **`ARCHITECTURE.md`**: Arquitetura completa do projeto, fluxos de usuário, modelo de dados, roadmap
- **`docs/migrations/`**: Histórico de migrações do banco de dados
- **`docs/history/`**: Histórico de mudanças e melhorias
- **`docs/client_profiles_usage_example.md`**: Exemplos de uso de perfis de cliente
- **`docs/CODE_REVIEW.md`**: Guia de revisão de código

## 🔒 Segurança

⚠️ **IMPORTANTE**: Nunca commite arquivos `.env*` no repositório!

As chaves do Supabase devem estar apenas em:
- `.env.local` (local, não versionado - adicione ao `.gitignore`)
- Variáveis de ambiente do servidor (produção)

### Boas Práticas de Segurança

- **Row Level Security (RLS)**: Configure políticas RLS no Supabase para proteger dados sensíveis
- **Validação**: Valide inputs no cliente e no servidor
- **Variáveis de Ambiente**: Use variáveis de ambiente para todas as credenciais sensíveis
- **Autenticação**: Sempre verifique autenticação antes de acessar rotas protegidas
- **Tokens**: Não armazene tokens de autenticação em texto plano
- **HTTPS**: Use sempre HTTPS em produção

## 🗺️ Navegação

### TabBar - Cliente

1. **Busca** (Home) - Ícone de busca, fundo vermelho quando ativo
2. **Agendamentos** - Ícone de calendário
3. **Perfil** - Ícone de perfil
4. **Configurações** - Ícone de configurações

### TabBar - Lojista

1. **Home** - Ícone de home
2. **Agenda** (Dashboard) - Ícone de calendário
3. **Serviços** - Ícone de negócio
4. **Perfil** - Ícone de perfil (fundo vermelho quando ativo)
5. **Configurações** - Ícone de configurações (fundo vermelho quando ativo)

## 🚧 Status do Projeto

Este é um projeto em desenvolvimento (POC). Veja `ARCHITECTURE.md` para o roadmap completo e status detalhado de implementação das funcionalidades.

### Funcionalidades Implementadas

#### ✅ Autenticação e Onboarding
- Login com email/senha
- Cadastro completo de Cliente (dados pessoais + endereço)
- Cadastro completo de Lojista (dados pessoais + negócio + serviços + endereço)
- Seleção de tipo de usuário
- Proteção de rotas baseada em roles
- Logout

#### 🚧 Fluxo do Cliente
- Home com busca
- Busca e resultados
- Perfil da loja
- Fluxo de agendamento (serviço → data → hora → confirmação)
- Meus agendamentos
- Detalhes do agendamento
- Reagendamento
- Perfil do cliente
- Editar perfil
- Alterar senha
- Configurações (FAQ, Termos)

#### 🚧 Fluxo do Lojista
- Home do lojista
- Dashboard com agenda
- Calendário mensal
- Detalhes do agendamento
- Reagendamento de agendamentos
- Gerenciamento de serviços (listar, criar, editar)
- Perfil do lojista
- Editar perfil
- Alterar senha
- Configurações (FAQ, Termos)

#### ⚠️ Em Desenvolvimento
- Google OAuth (configurado, precisa validação)
- Integração completa com Supabase (CRUD de serviços e agendamentos)
- Upload de imagens para Storage
- Validações de formulários
- Tratamento de erros aprimorado

## 🎯 Próximos Passos

1. Finalizar integração com Supabase (queries e mutations)
2. Implementar upload de imagens
3. Adicionar validações de formulários
4. Melhorar tratamento de erros e loading states
5. Polimento pixel-perfect conforme Figma

## 🔗 Links Úteis

- **Figma Lojista**: [Design do Lojista](https://www.figma.com/design/c1QOl8EocqBiGd6R2NzrFn/Wall-to-all?node-id=461-16428)
- **Figma Cliente**: [Design do Cliente](https://www.figma.com/design/c1QOl8EocqBiGd6R2NzrFn/Wall-to-all?node-id=577-2441)
- **Expo Router**: [Documentação](https://docs.expo.dev/router/introduction/)
- **Supabase**: [Documentação](https://supabase.com/docs)

## 💻 Desenvolvimento

### Estrutura de Rotas

O projeto utiliza Expo Router com file-based routing. As rotas são organizadas em grupos:

- `(auth)`: Rotas públicas de autenticação
- `(client)`: Rotas protegidas do cliente
- `(merchant)`: Rotas protegidas do lojista

### Convenções de Código

- **Estilos**: Use `StyleSheet.create()` exclusivamente (sem Tailwind ou Styled Components)
- **Tipos**: Sempre defina tipos TypeScript para props e estados
- **Componentes**: Organize componentes reutilizáveis em `components/`
- **Utilitários**: Funções auxiliares em `lib/`
- **Assets**: SVGs customizados em `assets/`, exportados via `lib/assets.ts`

### Adicionando Novas Telas

1. Crie o arquivo na pasta apropriada (`app/(client)/` ou `app/(merchant)/`)
2. Siga o padrão de nomenclatura existente
3. Implemente a proteção de rota se necessário
4. Adicione a rota na TabBar se for uma tab principal

## 📄 Licença

[Adicione a licença do projeto aqui]

## 👥 Contribuidores

[Adicione os contribuidores aqui]

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0.0  
**Status**: POC em desenvolvimento

