# Edge Function: Rate Limiting

Esta Edge Function implementa rate limiting no servidor para proteger contra abuso de API.

## 📋 Descrição

Complementa o rate limiting do cliente (`lib/hooks/useRateLimit.ts`) oferecendo proteção adicional no servidor.

## ⚙️ Configuração

### Parâmetros

- **RATE_LIMIT_WINDOW**: Janela de tempo em milissegundos (padrão: 60.000ms = 1 minuto)
- **MAX_REQUESTS**: Número máximo de requisições por janela (padrão: 10)

### Identificação

A função identifica requisições por:
1. Header `x-rate-limit-key` (se fornecido)
2. IP do cliente (`x-forwarded-for` ou `x-real-ip`)
3. Fallback: `'unknown'`

## 🚀 Deploy

### Via Supabase CLI

```bash
# Fazer login
supabase login

# Linkar ao projeto
supabase link --project-ref seu-project-ref

# Deploy da função
supabase functions deploy rate-limit
```

### Via Supabase Dashboard

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Edge Functions**
3. Clique em **Create a new function**
4. Nome: `rate-limit`
5. Cole o conteúdo de `index.ts`
6. Clique em **Deploy**

## 📡 Uso

### Chamada da Função

```typescript
// Exemplo de uso no cliente
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/rate-limit`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-rate-limit-key': email, // Opcional: usar email ou userId
      'Content-Type': 'application/json',
    },
  }
);

const data = await response.json();

if (response.status === 429) {
  // Rate limit excedido
  console.error(data.message);
  return;
}

if (data.success) {
  // Pode prosseguir com a operação
  console.log(`Tentativas restantes: ${data.remaining}`);
}
```

### Headers de Resposta

A função retorna headers úteis:

- `X-RateLimit-Limit`: Limite máximo de requisições
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Timestamp de quando o limite será resetado
- `Retry-After`: Segundos até poder tentar novamente (apenas em 429)

### Exemplo de Integração

```typescript
// lib/api.ts
export async function rateLimitedRequest<T>(
  fn: () => Promise<T>,
  identifier?: string
): Promise<T> {
  // Verificar rate limit primeiro
  const rateLimitResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/rate-limit`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        ...(identifier && { 'x-rate-limit-key': identifier }),
        'Content-Type': 'application/json',
      },
    }
  );

  if (rateLimitResponse.status === 429) {
    const data = await rateLimitResponse.json();
    throw new Error(data.message);
  }

  // Se passou, executar a função
  return await fn();
}
```

## 🔧 Personalização

Para ajustar os limites, edite as constantes no início de `index.ts`:

```typescript
const RATE_LIMIT_WINDOW = 60 * 1000; // Ajuste conforme necessário
const MAX_REQUESTS = 10; // Ajuste conforme necessário
```

## ⚠️ Limitações

- **Store em memória:** A implementação atual usa um objeto em memória
- **Não persistente:** Limites são resetados quando a função é reiniciada
- **Não distribuído:** Não funciona em múltiplas instâncias

### Para Produção em Escala

Considere usar:
- **Redis** para store distribuído
- **Banco de dados** para persistência
- **Supabase Realtime** para sincronização

## 📊 Monitoramento

Monitore a função através do Supabase Dashboard:
- **Edge Functions** → **rate-limit** → **Logs**
- Verifique requisições 429 (rate limit excedido)
- Ajuste limites conforme necessário

## 🔗 Referências

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Rate Limiting Best Practices](https://www.cloudflare.com/learning/bots/what-is-rate-limiting/)




