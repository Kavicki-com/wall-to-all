-- Migração: Políticas RLS para tabela reviews
-- Data: 2025-01-16
-- Descrição: Cria políticas RLS para permitir que clientes autenticados criem, leiam e atualizem avaliações

-- Habilitar RLS na tabela reviews (se ainda não estiver habilitado)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: Qualquer pessoa pode ler avaliações (públicas)
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT
  TO public
  USING (true);

-- Política de INSERT: Clientes autenticados podem criar avaliações
-- Permite avaliações de estabelecimento (business_id obrigatório) e de serviços
-- Se appointment_id for fornecido, deve pertencer ao cliente autenticado
CREATE POLICY "reviews_insert_authenticated" ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Cliente deve ser o usuário autenticado
    client_id = auth.uid()
    -- Deve ter business_id (obrigatório)
    AND business_id IS NOT NULL
    -- Rating deve estar entre 1 e 5
    AND rating IS NOT NULL
    AND rating >= 1
    AND rating <= 5
    -- Se tiver appointment_id, deve pertencer ao cliente
    AND (
      appointment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM appointments
        WHERE appointments.id = reviews.appointment_id
        AND appointments.client_id = auth.uid()
      )
    )
  );

-- Política de UPDATE: Clientes podem atualizar apenas suas próprias avaliações
-- Valida que o rating está entre 1 e 5
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (
    client_id = auth.uid()
    AND rating IS NOT NULL
    AND rating >= 1
    AND rating <= 5
  );

-- Política de DELETE: Clientes podem deletar apenas suas próprias avaliações (opcional)
CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE
  TO authenticated
  USING (client_id = auth.uid());

