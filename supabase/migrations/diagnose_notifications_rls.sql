-- ============================================
-- DIAGNÓSTICO: Políticas RLS da Tabela notifications
-- ============================================
-- Execute estas queries no Supabase SQL Editor para investigar o problema de RLS
-- antes de criar a função create_notification
-- ============================================

-- 1. Listar TODAS as políticas RLS da tabela notifications
-- Isso mostra todas as políticas (SELECT, INSERT, UPDATE, DELETE) e suas condições
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,  -- 'PERMISSIVE' ou 'RESTRICTIVE'
  roles,       -- 'public', 'authenticated', etc.
  cmd,         -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'
  qual,        -- Condição USING (para SELECT, UPDATE, DELETE)
  with_check   -- Condição WITH CHECK (para INSERT, UPDATE)
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- 2. Verificar se RLS está habilitado na tabela notifications
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'notifications';

-- 3. Verificar estrutura da tabela notifications
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 4. Verificar se existe alguma função relacionada a notifications
SELECT 
  routine_name,
  routine_type,
  security_type  -- 'DEFINER' ou 'INVOKER'
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name ILIKE '%notification%'
ORDER BY routine_name;

-- 5. Verificar permissões na tabela notifications
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'notifications'
ORDER BY grantee, privilege_type;

-- 6. Testar se podemos inserir (simular - não executa de verdade)
-- Esta query mostra quais políticas seriam aplicadas
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM notifications
WHERE false;  -- Não retorna nada, apenas verifica políticas

-- ============================================
-- INTERPRETAÇÃO DOS RESULTADOS
-- ============================================
-- 
-- Se a query 1 retornar:
-- - SEM políticas de INSERT: Não há política permitindo inserção (precisa criar)
-- - Com política INSERT mas USING/WITH CHECK restritivo: A política está muito restritiva
-- - Com política INSERT permitindo apenas user_id = auth.uid(): Precisamos de função RPC
--
-- Se a query 2 retornar rls_enabled = true: RLS está ativo (pode ser o problema)
-- Se a query 2 retornar rls_enabled = false: RLS desabilitado (não é o problema)
--
-- Se a query 4 retornar funções existentes: Podemos usar ou modificar essas funções
-- ============================================

-- ============================================
-- SOLUÇÕES POSSÍVEIS BASEADAS NO DIAGNÓSTICO
-- ============================================
--
-- CENÁRIO 1: Não há política de INSERT
--   → Criar política permitindo INSERT para authenticated com validação adequada
--   → OU criar função RPC com SECURITY DEFINER
--
-- CENÁRIO 2: Há política INSERT mas muito restritiva (só permite user_id = auth.uid())
--   → Criar função RPC com SECURITY DEFINER (melhor opção)
--   → OU criar política específica permitindo inserção para outros usuários em casos específicos
--
-- CENÁRIO 3: RLS está desabilitado mas ainda há erro
--   → O problema não é RLS, investigar outras causas (permissões, constraints, etc.)
--
-- ============================================


