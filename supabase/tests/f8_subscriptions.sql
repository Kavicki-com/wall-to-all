-- Teste de RLS da migration 20261103120000_f8_subscriptions.sql.
--
-- Roda dentro de BEGIN ... ROLLBACK: nada fica gravado. Dados 100% sintéticos
-- (uuids fixos de teste). Sucesso = o script termina sem exceção e devolve
-- 'f8_subscriptions: ok'; cada asserção dá RAISE EXCEPTION com o motivo.
--
-- Rodar pela Management API (POST /v1/projects/<ref>/database/query) com o
-- arquivo inteiro como `query`.

BEGIN;

-- ── Seed (como postgres, ignora RLS) ────────────────────────────────────────
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000d4', 'authenticated', 'authenticated', 'f8-sub-lojista-d@example.com',
   '{"user_type":"merchant","full_name":"Lojista D"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000e5', 'authenticated', 'authenticated', 'f8-sub-lojista-e@example.com',
   '{"user_type":"merchant","full_name":"Lojista E"}', now(), now());

INSERT INTO public.profiles (id, email, full_name, user_type)
VALUES
  ('00000000-0000-4000-8000-0000000000d4', 'f8-sub-lojista-d@example.com', 'Lojista D', 'merchant'),
  ('00000000-0000-4000-8000-0000000000e5', 'f8-sub-lojista-e@example.com', 'Lojista E', 'merchant')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE f8_sub_ids (k text PRIMARY KEY, v bigint) ON COMMIT DROP;
GRANT SELECT ON f8_sub_ids TO authenticated;

WITH b AS (
  INSERT INTO public.business_profiles (owner_id, business_name)
  VALUES ('00000000-0000-4000-8000-0000000000d4', 'Negocio Assinatura D')
  RETURNING id
)
INSERT INTO f8_sub_ids SELECT 'business_d', id FROM b;

WITH b AS (
  INSERT INTO public.business_profiles (owner_id, business_name)
  VALUES ('00000000-0000-4000-8000-0000000000e5', 'Negocio Assinatura E')
  RETURNING id
)
INSERT INTO f8_sub_ids SELECT 'business_e', id FROM b;

INSERT INTO public.subscriptions (business_id, provider_subscription_id, provider_customer_id,
                                  price_id, status, current_period_end)
SELECT v, 'sub_test_d', 'cus_test_d', 'price_test', 'active', now() + interval '30 days'
FROM f8_sub_ids WHERE k = 'business_d';

INSERT INTO public.subscriptions (business_id, provider_subscription_id, provider_customer_id,
                                  price_id, status, current_period_end)
SELECT v, 'sub_test_e', 'cus_test_e', 'price_test', 'past_due', now() + interval '3 days'
FROM f8_sub_ids WHERE k = 'business_e';

-- Regras da tabela (como postgres).
DO $$
BEGIN
  BEGIN
    INSERT INTO public.subscriptions (business_id, provider_subscription_id, status, current_period_end)
    SELECT v, 'sub_test_bad', 'trialing', now() FROM f8_sub_ids WHERE k = 'business_d';
    RAISE EXCEPTION 'FALHA: status fora do domínio aceito';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.subscriptions (business_id, provider_subscription_id, status, current_period_end)
    SELECT v, 'sub_test_d', 'active', now() FROM f8_sub_ids WHERE k = 'business_d';
    RAISE EXCEPTION 'FALHA: provider_subscription_id duplicado aceito';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- ── Lojista D ───────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000d4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.subscriptions;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: lojista D vê % assinaturas (esperado 1)', n; END IF;
  SELECT count(*) INTO n FROM public.subscriptions WHERE provider_subscription_id = 'sub_test_e';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: lojista D viu a assinatura de outro negócio'; END IF;

  BEGIN
    INSERT INTO public.subscriptions (business_id, provider_subscription_id, status, current_period_end)
    SELECT v, 'sub_hack', 'active', now() FROM f8_sub_ids WHERE k = 'business_d';
    RAISE EXCEPTION 'FALHA: authenticated inseriu em subscriptions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.subscriptions SET status = 'active';
    RAISE EXCEPTION 'FALHA: authenticated alterou subscriptions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.subscriptions;
    RAISE EXCEPTION 'FALHA: authenticated apagou subscriptions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ── Anônimo ─────────────────────────────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE anon;

DO $$
DECLARE
  n int;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.subscriptions;
    RAISE EXCEPTION 'FALHA: anon leu subscriptions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SELECT 'f8_subscriptions: ok' AS result;

ROLLBACK;
