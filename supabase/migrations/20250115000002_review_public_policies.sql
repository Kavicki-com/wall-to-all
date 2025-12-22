-- Migração: Revisar Políticas RLS Aplicadas a 'public'
-- Data: 2025-01-15
-- Descrição: Revisa e ajusta políticas RLS que usam 'public' para maior segurança

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Esta migração revisa políticas que usam 'TO public'.
-- Políticas com 'TO public' dependem inteiramente da lógica interna (USING/WITH CHECK)
-- para segurança. Se a lógica estiver incorreta, pode haver vulnerabilidades.
--
-- RECOMENDAÇÃO: Mudar para 'TO authenticated' onde apropriado, pois é mais seguro.
-- ============================================

-- ============================================
-- appointments - Revisar Políticas
-- ============================================

-- Exemplo: Se existir uma política "Client read own appointments" com TO public,
-- verificar se a validação interna está correta e considerar mudar para authenticated

-- Verificar e ajustar política de leitura de agendamentos do cliente
-- (Ajuste conforme necessário baseado nas políticas existentes)
DO $$
BEGIN
  -- Se a política existir com TO public e tiver validação adequada, manter
  -- Se não tiver validação adequada ou quiser maior segurança, alterar para authenticated
  
  -- Exemplo de alteração (descomente se necessário):
  -- ALTER POLICY "Client read own appointments" ON appointments
  --   TO authenticated;
  
  RAISE NOTICE 'Revisar manualmente as políticas de appointments que usam TO public';
END $$;

-- ============================================
-- appointment_reschedules - Revisar Políticas
-- ============================================

-- Todas as políticas de appointment_reschedules devem ter validação adequada
-- Recomendação: Mudar para 'TO authenticated' se ainda estiverem como 'TO public'

DO $$
BEGIN
  RAISE NOTICE 'Revisar manualmente as políticas de appointment_reschedules que usam TO public';
  RAISE NOTICE 'Garantir que todas tenham validação adequada de ownership';
END $$;

-- ============================================
-- client_profiles - Revisar Políticas
-- ============================================

-- Políticas de client_profiles devem garantir que usuários só acessem seus próprios perfis
-- Recomendação: Mudar para 'TO authenticated' se ainda estiverem como 'TO public'

DO $$
BEGIN
  RAISE NOTICE 'Revisar manualmente as políticas de client_profiles que usam TO public';
  RAISE NOTICE 'Garantir validação: user_id = auth.uid() em todas as operações';
END $$;

-- ============================================
-- business_availability_slots - Revisar Políticas
-- ============================================

-- Políticas devem garantir que apenas o dono do negócio possa modificar seus slots
-- Recomendação: Mudar para 'TO authenticated' se ainda estiverem como 'TO public'

DO $$
BEGIN
  RAISE NOTICE 'Revisar manualmente as políticas de business_availability_slots que usam TO public';
  RAISE NOTICE 'Garantir validação: business_id corresponde ao negócio do usuário autenticado';
END $$;

-- ============================================
-- QUERY PARA LISTAR TODAS AS POLÍTICAS COM 'public'
-- ============================================
-- Execute esta query no Supabase SQL Editor para ver todas as políticas que usam 'public':
--
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE roles::text LIKE '%public%'
-- ORDER BY tablename, policyname;
--
-- ============================================

-- ============================================
-- RECOMENDAÇÕES GERAIS
-- ============================================
-- 1. Revisar cada política listada pela query acima
-- 2. Verificar se a lógica de validação (USING/WITH CHECK) está correta
-- 3. Considerar mudar de 'TO public' para 'TO authenticated' onde apropriado
-- 4. Documentar a lógica de cada política para facilitar manutenção futura
-- 5. Testar todas as políticas após alterações
-- ============================================




