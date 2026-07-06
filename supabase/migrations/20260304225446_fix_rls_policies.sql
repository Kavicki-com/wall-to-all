-- ============================================================
-- FIX 1: rate_limits — remover policies de authenticated
--         e restringir ao service_role
-- ============================================================
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.rate_limits;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.rate_limits;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rate_limits;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.rate_limits;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.rate_limits;

-- A edge function usa service_role, então não precisamos de policy (service_role bypassa RLS)
-- Mas adicionamos uma explicitamente para clareza e auditoria:
CREATE POLICY "rate_limits_service_role_only"
  ON public.rate_limits
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FIX 2: services — corrigir role da policy "Owner manage services"
-- ============================================================
DROP POLICY IF EXISTS "Owner manage services" ON public.services;

CREATE POLICY "Owner manage services"
  ON public.services
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT owner_id FROM businesses WHERE id = business_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT owner_id FROM businesses WHERE id = business_id
    )
  );

-- ============================================================
-- FIX 3: business_availability_slots — corrigir role
-- ============================================================
DROP POLICY IF EXISTS "Clients read own appointments" ON public.business_availability_slots;

CREATE POLICY "Clients read own appointments"
  ON public.business_availability_slots
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);
