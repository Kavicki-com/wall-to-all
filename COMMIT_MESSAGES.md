# Mensagens de Commit - Padrão Conventional Commits

Este arquivo contém as mensagens de commit sugeridas para organizar as mudanças do repositório.

## 📋 Como Usar

1. Execute os comandos de verificação antes de commitar (veja seção abaixo)
2. Adicione os arquivos ao staging com `git add`
3. Use as mensagens de commit abaixo com `git commit -m "mensagem"` ou `git commit` (para editor)

---

## ✅ Comandos Pré-Commit

```bash
# Formatar código
npm run format:write

# Verificar TypeScript
npm run typecheck

# Executar testes
npm test

# Verificar linter (opcional - há warnings mas não erros)
npm run lint
```

---

## 📝 Mensagens de Commit

### 1. Configuração de Ferramentas de Desenvolvimento

```bash
git add .eslintrc.cjs .prettierrc jest.config.js jest.setup.ts package.json package-lock.json

git commit -m "feat(config): adicionar configuração ESLint, Prettier e Jest

- Adicionar .eslintrc.cjs com regras TypeScript e React
- Adicionar .prettierrc com configuração de formatação
- Adicionar jest.config.js e jest.setup.ts para testes
- Adicionar scripts de lint, format e test no package.json
- Configurar integração entre ESLint e Prettier"
```

---

### 2. Configuração de Ambiente

```bash
git add app.config.js env.example .gitignore

git commit -m "feat(config): adicionar suporte a variáveis de ambiente

- Adicionar app.config.js para injetar variáveis do Supabase
- Adicionar env.example como template de configuração
- Atualizar .gitignore para ignorar arquivos .env
- Garantir que credenciais não sejam versionadas"
```

---

### 3. Utilitários Responsivos

```bash
git add lib/responsive.ts

git commit -m "feat(utils): adicionar sistema de utilitários responsivos

- Adicionar lib/responsive.ts com funções e hooks responsivos
- Suportar breakpoints baseados em iPhone 12/13/14
- Incluir funções para width, height, fontSize e cards
- Adicionar hooks reativos para mudanças de dimensão
- Documentar todas as funções com JSDoc"
```

---

### 4. Utilitários de Roteamento

```bash
git add lib/router-utils.ts

git commit -m "feat(utils): adicionar função safeGoBack para navegação segura

- Adicionar lib/router-utils.ts com função safeGoBack
- Prevenir erros quando não há histórico de navegação
- Implementar fallback para rota padrão"
```

---

### 5. Estrutura de Testes

```bash
git add __tests__/

git commit -m "feat(test): adicionar estrutura básica de testes

- Adicionar smoke test para verificar renderização básica
- Adicionar testes unitários para funções utilitárias
- Configurar Jest com suporte a React Native e Expo
- Garantir que todos os testes estão passando"
```

---

### 6. Atualizações em Componentes e Rotas

**Opção A: Commit único (mais simples)**

```bash
git add app/ components/ context/ lib/supabase.ts

git commit -m "refactor: aplicar formatação e melhorias em componentes e rotas

- Aplicar formatação Prettier em todos os arquivos
- Atualizar imports e estrutura conforme necessário
- Melhorar consistência de código em telas de autenticação
- Atualizar componentes de cliente e lojista"
```

**Opção B: Commits separados por módulo (mais organizado)**

```bash
# Autenticação
git add app/(auth)/ app/_layout.tsx app/index.tsx

git commit -m "refactor(auth): aplicar formatação em telas de autenticação

- Aplicar formatação Prettier
- Atualizar imports e estrutura
- Melhorar consistência de código"

# Cliente
git add app/(client)/

git commit -m "refactor(client): aplicar formatação em fluxo do cliente

- Aplicar formatação Prettier
- Atualizar imports e estrutura
- Melhorar consistência de código"

# Lojista
git add app/(merchant)/

git commit -m "refactor(merchant): aplicar formatação em fluxo do lojista

- Aplicar formatação Prettier
- Atualizar imports e estrutura
- Melhorar consistência de código"

# Componentes e Context
git add components/ context/ lib/supabase.ts

git commit -m "refactor: aplicar formatação em componentes e context

- Aplicar formatação Prettier
- Atualizar imports e estrutura
- Melhorar consistência de código"
```

---

### 7. Documentação

```bash
git add README.md

git commit -m "docs: atualizar README com novas configurações e estrutura

- Documentar novas ferramentas de desenvolvimento (ESLint, Prettier, Jest)
- Atualizar instruções de setup e instalação
- Adicionar informações sobre testes e linting
- Documentar sistema de utilitários responsivos
- Atualizar estrutura do projeto"
```

---

### 8. Remoção de Arquivo

```bash
git add components/ui/README.md

git commit -m "chore: remover README.md não utilizado de components/ui

- Remover components/ui/README.md que não é mais necessário"
```

---

### 9. Nova Funcionalidade (se aplicável)

```bash
git add app/(merchant)/home/share.tsx

git commit -m "feat(merchant): adicionar tela de compartilhamento

- Adicionar app/(merchant)/home/share.tsx
- Implementar funcionalidade de compartilhamento do negócio"
```

---

### 10. Configuração CI/CD (se aplicável)

```bash
git add .github/

git commit -m "ci: adicionar configuração de GitHub Actions

- Adicionar workflows do GitHub Actions
- Configurar CI para lint, typecheck e testes"
```

---

## 🔄 Script Completo (Exemplo)

Se preferir executar tudo de uma vez, aqui está um exemplo de sequência:

```bash
# 1. Verificações
npm run format:write
npm run typecheck
npm test

# 2. Commits
git add .eslintrc.cjs .prettierrc jest.config.js jest.setup.ts package.json package-lock.json
git commit -m "feat(config): adicionar configuração ESLint, Prettier e Jest

- Adicionar .eslintrc.cjs com regras TypeScript e React
- Adicionar .prettierrc com configuração de formatação
- Adicionar jest.config.js e jest.setup.ts para testes
- Adicionar scripts de lint, format e test no package.json"

git add app.config.js env.example .gitignore
git commit -m "feat(config): adicionar suporte a variáveis de ambiente

- Adicionar app.config.js para injetar variáveis do Supabase
- Adicionar env.example como template
- Atualizar .gitignore para ignorar arquivos .env"

git add lib/responsive.ts
git commit -m "feat(utils): adicionar sistema de utilitários responsivos

- Adicionar lib/responsive.ts com funções e hooks responsivos
- Suportar breakpoints baseados em iPhone 12/13/14"

git add lib/router-utils.ts
git commit -m "feat(utils): adicionar função safeGoBack para navegação segura

- Adicionar lib/router-utils.ts com função safeGoBack
- Prevenir erros quando não há histórico de navegação"

git add __tests__/
git commit -m "feat(test): adicionar estrutura básica de testes

- Adicionar smoke test e testes unitários
- Configurar Jest com suporte a React Native e Expo"

git add app/ components/ context/ lib/supabase.ts
git commit -m "refactor: aplicar formatação e melhorias em componentes e rotas

- Aplicar formatação Prettier em todos os arquivos
- Atualizar imports e estrutura conforme necessário"

git add README.md
git commit -m "docs: atualizar README com novas configurações e estrutura

- Documentar novas ferramentas de desenvolvimento
- Atualizar instruções de setup e instalação"

git add components/ui/README.md
git commit -m "chore: remover README.md não utilizado de components/ui"

# 3. Push (quando estiver pronto)
git push origin main
```

---

## 📚 Referência: Conventional Commits

Formato: `<tipo>(<escopo>): <descrição>`

**Tipos comuns:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Formatação, ponto e vírgula, etc (não afeta código)
- `refactor`: Refatoração de código
- `test`: Adicionar ou corrigir testes
- `chore`: Tarefas de manutenção
- `ci`: Mudanças em CI/CD
- `config`: Mudanças em configuração

**Escopo (opcional):**
- `auth`, `client`, `merchant`, `utils`, `config`, `test`, etc.

---

## ⚠️ Notas Importantes

1. **Não commite arquivos `.env`** - Eles devem estar no `.gitignore`
2. **Execute os testes** antes de cada commit importante
3. **Mantenha commits atômicos** - Um commit, uma funcionalidade
4. **Use mensagens descritivas** - Explique o "porquê", não apenas o "o quê"
5. **Revise antes de push** - Use `git log` para verificar o histórico

