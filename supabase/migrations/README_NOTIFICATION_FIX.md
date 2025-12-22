# Correção do Problema de Notificações (RLS)

## Problema Identificado

As notificações não estão sendo enviadas devido a uma violação de Row Level Security (RLS). O erro `42501` indica que as políticas RLS estão impedindo que usuários insiram notificações para outros usuários.

## ⚠️ IMPORTANTE: Diagnóstico Primeiro

**ANTES de aplicar qualquer correção**, execute o diagnóstico para entender o estado atual das políticas RLS.

### Passo 1: Executar Diagnóstico

1. Acesse o **Supabase Dashboard**: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Abra o arquivo `diagnose_notifications_rls.sql`
5. Copie e cole as queries no SQL Editor
6. Execute e analise os resultados

### Passo 2: Interpretar os Resultados

Com base no diagnóstico, você saberá:
- Se existe política de INSERT
- Qual é a restrição atual
- Se RLS está habilitado
- Se já existem funções relacionadas

### Passo 3: Escolher a Solução

**Opção A - Função RPC (Recomendada)**:
- Use `create_notification_function.sql` se quiser uma solução mais segura e centralizada
- Permite validações adicionais e auditoria
- Mais fácil de manter

**Opção B - Política RLS Direta**:
- Use `alternative_fix_insert_policy.sql` se quiser uma solução mais simples
- Permite INSERT direto via política RLS
- Menos controle centralizado

## Solução Recomendada: Função RPC

Foi criada uma função PostgreSQL (`create_notification`) que executa com `SECURITY DEFINER`, permitindo bypass de RLS para inserir notificações.

## Como Aplicar a Correção

1. Acesse o **Supabase Dashboard**: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor** (no menu lateral)
4. Copie e cole o conteúdo do arquivo `create_notification_function.sql`
5. Clique em **Run** para executar a função

A função será criada e os usuários autenticados terão permissão para executá-la.

## Como Funciona

A função `create_notification`:
- Executa com privilégios elevados (`SECURITY DEFINER`)
- Bypassa as políticas RLS
- Permite que qualquer usuário autenticado crie notificações para outros usuários
- Valida os dados de entrada
- Retorna o ID da notificação criada

## Código Atualizado

O código em `lib/notifications.ts` foi atualizado para:
1. Detectar erros RLS (código `42501`)
2. Tentar usar a função RPC `create_notification` automaticamente
3. Fallback para o método direto se a função RPC não estiver disponível
4. Logar erros apropriadamente para debug

## Verificação

Após executar a migration SQL, teste enviando uma notificação:
- Cliente solicita reagendamento → Merchant deve receber notificação
- Cliente aceita reagendamento → Merchant deve receber notificação
- Merchant cria reagendamento → Cliente deve receber notificação

Se ainda houver problemas, verifique os logs para ver se a função RPC está sendo chamada corretamente.

