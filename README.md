# Wall-to-All

Plataforma mobile que conecta clientes a prestadores de serviços locais, fornecendo uma experiência completa de agendamento e gestão de negócios.

## 📦 Instalação

```bash
git clone https://github.com/Kavicki-com/wall-to-all.git
cd wall-to-all
npm install
```

## 🚀 Uso

### Configuração

Crie o arquivo `.env` com suas credenciais Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### Executando

```bash
# Servidor de desenvolvimento
npm start

# Android
npm run android

# iOS (requer macOS)
npm run ios
```

## 🎨 Funcionalidades

### Cliente
- Busca e descoberta de serviços locais
- Agendamento de horários em tempo real
- Histórico de agendamentos
- Avaliações e favoritos

### Lojista
- Dashboard completo do negócio
- Gerenciamento de serviços e preços
- Calendário integrado de agendamentos
- Perfil do negócio personalizável

## 🛠️ Desenvolvimento

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta Supabase

### Scripts Disponíveis

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm start

# Type checking
npm run typecheck

# Lint
npm run lint

# Formatação
npm run format:write

# CI check (typecheck + lint)
npm run ci:check
```

### Build & Deploy (EAS)

```bash
# Build de preview (interno)
eas build --platform android --profile preview

# Build de produção
eas build --platform android --profile production

# Submit para Play Store
eas submit --platform android
```

### Estrutura do Projeto

```
wall-to-all/
├── app/                      # Expo Router (file-based routing)
│   ├── (auth)/              # Fluxo de autenticação
│   ├── (client)/            # Área do Cliente
│   └── (merchant)/          # Área do Lojista
├── components/              # Componentes reutilizáveis
│   ├── appointments/        # Cards de agendamento
│   ├── calendar/            # Calendário customizado
│   ├── profile/             # Componentes de perfil
│   └── ui/                  # Componentes base
├── context/                 # Context API
│   └── AuthContext.tsx      # Gerenciamento de sessão
├── lib/                     # Utilitários e helpers
│   ├── supabase.ts          # Cliente Supabase
│   └── hooks/               # Custom hooks
├── assets/                  # SVGs, imagens, branding
└── android/                 # Código nativo Android
```

## 🔐 Autenticação

- Email/Senha com validação
- Google OAuth (deep linking)
- Recuperação de senha
- Sistema de roles (`client` | `merchant`)

## 🎯 Stack Tecnológica

| Tecnologia | Versão |
|-----------|--------|
| React Native | 0.81.5 |
| Expo | ~54.0.31 |
| Expo Router | ~6.0.21 |
| TypeScript | ~5.9.2 |
| Supabase | ^2.85.0 |
| date-fns | ^4.1.0 |

## 📄 Licença

Privado © Kavicki


## 📞 Suporte

Para dúvidas ou suporte, entre em contato com a equipe de desenvolvimento da Kavicki.
