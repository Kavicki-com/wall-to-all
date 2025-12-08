# Wall-to-All

Plataforma mobile desenvolvida com React Native e Expo que conecta clientes a prestadores de serviços locais.

## 📋 Visão Geral

O **Wall-to-All** oferece dois fluxos distintos:
- **Clientes**: Busca e agendamento de serviços
- **Lojistas**: Gerenciamento de negócio e agenda

## 🛠️ Stack Tecnológico

- **Framework**: React Native 0.76.9
- **Expo**: ~52.0.0
- **Roteamento**: Expo Router ~4.0.21 (file-based routing)
- **Linguagem**: TypeScript 5.9.2
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **UI**: StyleSheet.create() exclusivamente (pixel-perfect do Figma)

## 📦 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Conta no Supabase (para backend)

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

### 4. Execute o projeto

```bash
npm start
# ou
yarn start
```

Depois, escaneie o QR code com:
- **iOS**: Câmera nativa ou Expo Go
- **Android**: Expo Go app

## 📁 Estrutura do Projeto

```
wall-to-all/
├── app/                    # Expo Router (file-based routing)
│   ├── (auth)/            # Rotas de autenticação
│   ├── (client)/          # Fluxo do Cliente
│   └── (merchant)/        # Fluxo do Lojista
├── components/             # Componentes reutilizáveis
├── context/               # Context API (AuthContext)
├── lib/                    # Utilitários e helpers
│   ├── supabase.ts        # Cliente Supabase
│   ├── assets.ts          # SVGs customizados
│   └── icons.tsx          # Helper de ícones
├── assets/                 # Assets estáticos
└── docs/                  # Documentação
```

## 🔐 Autenticação

O projeto utiliza Supabase para autenticação:

- **Email/Senha**: Login tradicional
- **Google OAuth**: Login com Google (configurado)
- **Roles**: `client` ou `merchant` (definido no cadastro)

### Estrutura de Dados

O projeto espera as seguintes tabelas no Supabase:

- `profiles`: Perfis de usuários (client/merchant)
- `categories`: Categorias de serviços
- `services`: Serviços oferecidos pelos lojistas
- `appointments`: Agendamentos
- `reviews`: Avaliações

Veja `ARCHITECTURE.md` para mais detalhes sobre o schema.

## 🎨 Design System

O projeto segue fielmente o design do Figma:

- **Cores**: 
  - Primária: `#E5102E` (Vermelho)
  - Texto: `#000E3D` (Azul escuro)
  - Superfície: `#FEFEFE` (Branco)
- **Tipografia**: 
  - Títulos: Montserrat Bold (24px)
  - Corpo: Roboto Regular (16px)
- **Estilos**: 100% StyleSheet.create() (sem Tailwind/Styled Components)

## 📱 Scripts Disponíveis

```bash
# Iniciar servidor de desenvolvimento
npm start

# Executar no Android
npm run android

# Executar no iOS
npm run ios

# Executar na web
npm run web
```
## 📚 Documentação Adicional

- `ARCHITECTURE.md`: Arquitetura completa do projeto
- `docs/troubleshooting/`: Guias de troubleshooting
- `docs/migrations/`: Histórico de migrações
- `docs/history/`: Histórico de mudanças

## 🔒 Segurança

As chaves do Supabase devem estar apenas em:
- `.env.local` (local, não versionado)
- Variáveis de ambiente do servidor (produção)

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0.0

