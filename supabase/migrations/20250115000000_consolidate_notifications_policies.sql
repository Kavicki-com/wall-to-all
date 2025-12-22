-- Migração: Consolidar Políticas RLS Duplicadas na Tabela notifications
-- Data: 2025-01-15
-- Descrição: Remove políticas duplicadas e mantém apenas uma política bem definida para UPDATE

-- Remover políticas duplicadas de UPDATE
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Verificar se a política consolidada já existe antes de criar
-- Se existir, removê-la primeiro para recriar com a definição correta
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

-- Criar política consolidada e bem definida para UPDATE
-- Esta política permite que usuários autenticados atualizem apenas suas próprias notificações
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Comentário para documentação
COMMENT ON POLICY "notifications_update_own" ON notifications IS 
  'Permite que usuários autenticados atualizem apenas suas próprias notificações. 
   Valida ownership tanto na cláusula USING quanto na WITH CHECK para garantir segurança.';




