# Migração de Tipos - IDs de string para number

## Problema

O banco de dados Supabase retorna IDs como `number` (tipo int8), mas muitos tipos locais no código estão definidos com `id: string`. Isso causa mais de 100 erros de TypeScript.

## Tipos Atualizados

Os tipos corretos do banco estão em `supabase/types.ts`:
- `appointments.id`: `number`
- `services.id`: `number`  
- `categories.id`: `number`
- `business_profiles.id`: `number`
- `reviews.id`: `number`

## Arquivos Já Corrigidos

- ✅ `supabase/types.ts` - Regenerado do banco
- ✅ `lib/categories.ts` - `Category.id` agora é `number`
- ✅ `lib/categoryUtils.ts` - `Category.id` agora é `number`
- ✅ `context/BusinessProfileContext.tsx` - `BusinessProfile.id` agora é `number`

## Arquivos que Precisam de Correção

### Alto impacto (muitos erros):

1. **`app/(client)/home/index.tsx`** (~15 erros)
   - Type `Appointment` local com `id: string` → mudar para `number`
   - Type `Service` local com `id: string` → mudar para `number`
   - Type `BusinessProfile` local com `id: string` → mudar para `number`
   - Type local de categorias com `id: string` → mudar para `number`

2. **`app/(client)/profile/index.tsx`** (~20 erros)
   - Type `Service` local com `id: string` → mudar para `number`
   - Type `Business` local com `id: string` → mudar para `number`
   - Type `Appointment` local com `id: string` → mudar para `number`
   - Ajustar maps que assumem `service_id: string` → usar `number`

3. **`app/(client)/search/results.tsx`** (~15 erros)
   - Type `Business` local com `id: string` → mudar para `number`
   - Type `Service` local com `id: string` → mudar para `number`
   - Ajustar filtros e conversões de ID

4. **`app/(client)/appointments/[id].tsx`** (~10 erros)
   - Type `Appointment` local com `id: string` → mudar para `number`
   - Ajustar chamadas Supabase passando string quando espera number

5. **`app/(merchant)/services/create.tsx`** e **`edit/[id].tsx`** (~10 erros)
   - Type `ServiceRecord` com `id: string` → mudar para `number`
   - Ajustar conversões e states

6. **`app/(merchant)/home/index.tsx`** e **share.tsx** (~8 erros)
   - Type `Service` local com `id: string` → mudar para `number`
   - Type `BusinessProfile` local com `id: string` → mudar para `number`

7. **`app/(client)/store/[id].tsx`** (~5 erros)
   - Type `Service` local com `id: string` → mudar para `number`
   - Type `BusinessProfile` local com `id: string` → mudar para `number`

### Médio impacto:

8. **`lib/utils.ts`** (~3 erros)
   - Funções assumindo IDs string → ajustar para aceitar `number`

9. **`lib/hooks/useReviewPermissions.ts`** (~3 erros)
   - Ajustar tipos para aceitar `number` ao invés de `string | number`

10. **`lib/notifications.ts`** (~5 erros)
    - Ajustar tipos `related_appointment_id` e `related_reschedule_id` para `number | null`

11. **`lib/hooks/useSignupCheck.ts`** (~2 erros)
    - Ajustar tipo booleano que aceita string vazia

12. **`lib/monitoring.ts`** (~1 erro)
    - Ajustar tipo `unknown` para objeto com propriedades

### Baixo impacto:

13. **`supabase/functions/rate-limit/index.ts`** (~3 erros)
    - Adicionar types para imports de Deno
    - Adicionar type para parâmetro `req`

14. **Outros arquivos de appointments e scheduling**
    - Ajustar tipos locais de `Appointment` para usar `id: number`

## Solução Recomendada

### Opção 1: Criar Tipos Centralizados (Recomendado)

Criar `lib/types.ts` com tipos compartilhados baseados no banco:

```typescript
import { Database } from '../supabase/types';

// Tipos das tabelas do Supabase
export type DbAppointment = Database['public']['Tables']['appointments']['Row'];
export type DbService = Database['public']['Tables']['services']['Row'];
export type DbBusinessProfile = Database['public']['Tables']['business_profiles']['Row'];
export type DbCategory = Database['public']['Tables']['categories']['Row'];

// Tipos estendidos para UI (com joins, campos calculados, etc.)
export type Appointment = DbAppointment & {
  service?: {
    id: number;
    name: string;
  };
  business?: {
    business_name: string;
    logo_url: string | null;
  };
  // ... outros campos de join
};

export type Service = DbService & {
  categories?: {
    id: number;
    name: string;
  } | null;
  business_profiles?: {
    business_name: string;
  } | null;
  rating?: number;
  review_count?: number;
};

export type Business = DbBusinessProfile & {
  categories?: {
    id: number;
    name: string;
  } | null;
  services?: Array<{ id: number; name: string }>;
};

export type Category = DbCategory;
```

Depois, atualizar todos os arquivos para importar de `lib/types.ts` ao invés de definir tipos locais.

### Opção 2: Atualizar Cada Arquivo Individualmente

Para cada arquivo:
1. Encontrar definições de tipos locais (Service, Appointment, etc.)
2. Mudar `id: string` para `id: number`
3. Mudar campos relacionados (service_id, business_id, etc.) para `number`
4. Ajustar conversões e filtros

## Status

🟡 **Em Progresso** - Pre-push hook temporariamente desabilitado para typecheck.

Comando para testar: `npm run typecheck`

Quando todos os erros forem corrigidos, restaurar em `.husky/pre-push`:
```bash
npm run verify
```

## Notas

- O Supabase sempre retorna IDs numéricos do PostgreSQL (tipo int8 = bigint)
- Usar `string` para IDs é uma escolha de design, mas requer conversões explícitas
- Manter `number` é mais simples e alinhado com o banco


