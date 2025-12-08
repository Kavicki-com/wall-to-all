# Como Usar client_profiles

## Estrutura de Dados

### `profiles` (dados gerais)
- `id` - UUID do usuário
- `full_name` - Nome completo
- `avatar_url` - URL do avatar
- `user_type` - Tipo de usuário ('client' | 'merchant')
- `email` - Email do usuário
- `created_at` / `updated_at`

### `client_profiles` (dados específicos de cliente)
- `id` - UUID do perfil
- `owner_id` - Referência ao `profiles.id`
- `address` - Endereço do cliente
- `created_at` / `updated_at`

---

## Exemplos de Uso

### 1. Buscar dados gerais + endereço

```typescript
const fetchClientFullProfile = async (userId: string) => {
  // Buscar profiles e client_profiles juntos
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      client_profile:client_profiles(*)
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Erro:', error);
    return null;
  }

  return {
    ...data,
    address: data.client_profile?.[0]?.address || null,
  };
};
```

### 2. Atualizar apenas endereço

```typescript
const updateClientAddress = async (userId: string, address: string) => {
  const { error } = await supabase
    .from('client_profiles')
    .upsert({
      owner_id: userId,
      address: address,
    });

  if (error) {
    console.error('Erro ao atualizar endereço:', error);
    return false;
  }

  return true;
};
```

### 3. Buscar apenas endereço

```typescript
const fetchClientAddress = async (userId: string) => {
  const { data, error } = await supabase
    .from('client_profiles')
    .select('address')
    .eq('owner_id', userId)
    .single();

  if (error) {
    console.error('Erro:', error);
    return null;
  }

  return data?.address || null;
};
```

---

## Quando Usar Cada Tabela

### Use `profiles` para:
- Nome, avatar, email (dados gerais)
- Informações de autenticação
- Dados compartilhados entre cliente e lojista

### Use `client_profiles` para:
- Endereço do cliente (residencial)
- Preferências específicas de cliente
- Histórico/estatísticas de cliente
- Qualquer dado que APENAS clientes precisam

### Use `business_profiles` para:
- Dados do negócio (nome da loja, endereço comercial)
- Horários de funcionamento
- Métodos de pagamento aceitos
- Qualquer dado que APENAS lojistas precisam

