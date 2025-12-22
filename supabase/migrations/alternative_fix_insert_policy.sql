-- ============================================
-- ALTERNATIVA: Criar Política de INSERT ao invés de função RPC
-- ============================================
-- Esta é uma alternativa à função create_notification
-- Permite que usuários autenticados criem notificações para outros usuários
-- Execute APENAS se o diagnóstico mostrar que não há política de INSERT adequada
-- ============================================

-- IMPORTANTE: Verifique primeiro com diagnose_notifications_rls.sql
-- para entender o estado atual das políticas antes de executar este script

-- Opção 1: Política permissiva (permite qualquer usuário autenticado criar notificações)
-- ATENÇÃO: Menos seguro, mas mais simples
CREATE POLICY "notifications_insert_authenticated" ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Permite qualquer inserção de usuários autenticados

-- Opção 2: Política mais restritiva (valida que o user_id existe)
-- Mais seguro, mas ainda permite criar para qualquer usuário
CREATE POLICY "notifications_insert_authenticated_validated" ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Garante que o user_id fornecido existe na tabela profiles
    EXISTS (
      SELECT 1 FROM profiles WHERE id = notifications.user_id
    )
  );

-- ============================================
-- RECOMENDAÇÃO
-- ============================================
-- A função RPC (create_notification_function.sql) é MAIS SEGURA porque:
-- 1. Centraliza a lógica de criação de notificações
-- 2. Permite adicionar validações adicionais no futuro
-- 3. Pode incluir logs, auditoria, etc.
-- 4. É mais fácil manter e depurar
--
-- Use esta política apenas se:
-- - Você não puder criar funções RPC
-- - Você quiser uma solução mais simples e direta
-- - Você confia que todos os lugares do código validam corretamente antes de chamar
-- ============================================



