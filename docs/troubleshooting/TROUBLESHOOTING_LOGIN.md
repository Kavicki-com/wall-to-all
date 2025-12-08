# 🔧 Troubleshooting - Login sem Perfil

## 🐛 Problema

Login bem-sucedido no Supabase Auth, mas o app não redireciona porque o perfil não existe na tabela `profiles`.

### Sintomas
```
✅ Login OK: userId 34d26470-9d45-478a-b3df-ac6b6ce4a284
❌ Perfil não encontrado (data é null)
❌ userRole = null → app trava na tela de login
```

---

## 🔍 Causas

1. **Perfil criado direto no Auth** - Usuário criado no Supabase Auth sem registro correspondente na tabela `profiles`
2. **Trigger não configurado** - Não há trigger automático para criar perfil após signup
3. **Perfil deletado** - Perfil foi removido da tabela `profiles` mas usuário ainda existe no Auth

---

## ✅ Soluções

### Solução 1: Criar Perfil Manualmente (IMEDIATO)

#### Passo 1: Abra o Supabase Dashboard
1. Acesse: https://app.supabase.com
2. Selecione seu projeto **Wall-to-All**
3. Vá em **Table Editor** → `profiles`

#### Passo 2: Inserir Registro

Clique em **Insert Row** e preencha:

| Campo | Valor | Exemplo |
|-------|-------|---------|
| `id` | UUID do usuário | `34d26470-9d45-478a-b3df-ac6b6ce4a284` |
| `user_type` | `merchant` ou `client` | `merchant` |
| `email` | Email do usuário | `gabriel@exemplo.com` |
| `full_name` | Nome completo | `Gabriel Silva` |
| `created_at` | Timestamp atual | `2025-12-03 10:00:00` |
| `updated_at` | Timestamp atual | `2025-12-03 10:00:00` |

**OU use o SQL Editor**:

```sql
-- Substituir valores pelos dados corretos
INSERT INTO profiles (
  id, 
  user_type, 
  email, 
  full_name, 
  created_at, 
  updated_at
)
VALUES (
  '34d26470-9d45-478a-b3df-ac6b6ce4a284', -- UserId do log
  'merchant',                              -- ou 'client'
  'seu@email.com',                         -- Email do usuário
  'Seu Nome',                              -- Nome completo
  NOW(),
  NOW()
);
```

#### Passo 3: Fazer Login Novamente

Agora o login deve funcionar! ✅

---

### Solução 2: Configurar Trigger Automático (RECOMENDADO)

Para **prevenir** esse problema no futuro:

#### Passo 1: Abra o SQL Editor no Supabase

#### Passo 2: Execute o SQL abaixo

```sql
-- Função que cria perfil automaticamente quando usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar perfil com dados básicos do auth.users
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Trigger que executa após INSERT em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

#### Passo 3: Verificar Trigger

```sql
-- Verificar se trigger foi criado
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Agora **todos os novos usuários** terão perfil criado automaticamente! ✅

---

### Solução 3: Verificar Perfis Existentes

Para encontrar usuários sem perfil:

```sql
-- Usuários no Auth sem perfil na tabela profiles
SELECT 
  au.id,
  au.email,
  au.created_at,
  'SEM PERFIL' as status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;
```

**Criar perfis para todos esses usuários**:

```sql
-- Criar perfis em lote para usuários sem perfil
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name',
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

---

## 🛠️ Melhorias Implementadas no App

### 1. **Logs Detalhados** (`context/AuthContext.tsx`)

Agora quando o perfil não é encontrado, você verá:

```
⚠️ [AuthContext] PERFIL NÃO ENCONTRADO na tabela profiles!
⚠️ UserId: 34d26470-9d45-478a-b3df-ac6b6ce4a284
⚠️ Possíveis causas:
   1. Perfil foi criado direto no Auth sem registro na tabela profiles
   2. Trigger de criação automática não está ativo
   3. Perfil foi deletado da tabela profiles
⚠️ Solução: Criar registro na tabela profiles com este userId
```

### 2. **Alerta Visual** (`app/_layout.tsx`)

Agora aparece um alerta na tela:

```
⚠️ Erro de Perfil

Seu usuário foi autenticado, mas não encontramos 
seu perfil no banco de dados.

UserId: 34d26470-9d45-478a-b3df-ac6b6ce4a284

Por favor, entre em contato com o suporte ou 
crie o perfil manualmente no Supabase.

[Fazer Logout] [OK]
```

### 3. **Novo Campo no AuthContext**

```typescript
interface AuthContextType {
  session: Session | null;
  userRole: UserRole;
  isLoading: boolean;
  profileError: string | null; // ✅ Novo campo para erros
}
```

---

## 📋 Checklist de Verificação

Quando um login falhar:

- [ ] **Verificar log no console**
  - `[AuthContext] Perfil não encontrado`
  - Copiar o `userId` do log

- [ ] **Verificar se usuário existe no Auth**
  ```sql
  SELECT * FROM auth.users WHERE id = 'userId-do-log';
  ```

- [ ] **Verificar se perfil existe**
  ```sql
  SELECT * FROM profiles WHERE id = 'userId-do-log';
  ```

- [ ] **Se perfil NÃO existe**, criar manualmente:
  ```sql
  INSERT INTO profiles (id, user_type, email, full_name, created_at, updated_at)
  VALUES ('userId-do-log', 'merchant', 'email@exemplo.com', 'Nome', NOW(), NOW());
  ```

- [ ] **Verificar trigger automático**
  ```sql
  SELECT * FROM information_schema.triggers 
  WHERE trigger_name = 'on_auth_user_created';
  ```

- [ ] **Se trigger NÃO existe**, criar usando Solução 2

- [ ] **Fazer logout e login novamente no app**

---

## 🎯 Exemplo Completo

### Cenário: Usuário `gabriel@exemplo.com` não consegue logar

#### 1. Ver o log
```
[AuthContext] Perfil não encontrado (data é null) para userId: 34d26470-9d45-478a-b3df-ac6b6ce4a284
```

#### 2. Verificar no Supabase SQL Editor
```sql
-- Existe no Auth?
SELECT id, email FROM auth.users 
WHERE id = '34d26470-9d45-478a-b3df-ac6b6ce4a284';
-- ✅ Retorna: id, gabriel@exemplo.com

-- Existe na tabela profiles?
SELECT id, email, user_type FROM profiles 
WHERE id = '34d26470-9d45-478a-b3df-ac6b6ce4a284';
-- ❌ Retorna: vazio (0 rows)
```

#### 3. Criar o perfil
```sql
INSERT INTO profiles (id, user_type, email, full_name, created_at, updated_at)
VALUES (
  '34d26470-9d45-478a-b3df-ac6b6ce4a284',
  'merchant',
  'gabriel@exemplo.com',
  'Gabriel Silva',
  NOW(),
  NOW()
);
-- ✅ INSERT 0 1
```

#### 4. Verificar
```sql
SELECT * FROM profiles 
WHERE id = '34d26470-9d45-478a-b3df-ac6b6ce4a284';
-- ✅ Retorna: perfil completo
```

#### 5. Fazer login novamente no app
```
✅ Login bem-sucedido
✅ Perfil encontrado: merchant
✅ Redirecionado para /(merchant)/dashboard
```

---

## 📞 Suporte

Se o problema persistir após seguir este guia:

1. Verifique os logs completos do console
2. Tire screenshot do erro
3. Execute os SQLs de verificação acima
4. Entre em contato com o desenvolvedor com essas informações

---

## 📚 Arquivos Relacionados

- `context/AuthContext.tsx` - Lógica de autenticação
- `app/_layout.tsx` - Proteção de rotas e alerta de erro
- `supabase/create_profile_trigger.sql` - SQL para trigger automático

---

**Última atualização**: 3 de Dezembro de 2025

