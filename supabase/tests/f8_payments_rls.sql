-- Teste de RLS e regras da migration 20261102120000_f8_payments.sql.
--
-- Roda dentro de BEGIN ... ROLLBACK: nada fica gravado. Dados 100% sintéticos
-- (uuids fixos de teste). Sucesso = o script termina sem exceção e devolve
-- 'f8_payments_rls: ok'; cada asserção dá RAISE EXCEPTION com o motivo.
--
-- Rodar pela Management API (POST /v1/projects/<ref>/database/query) com o
-- arquivo inteiro como `query`.

BEGIN;

-- ── Seed (como postgres, ignora RLS) ────────────────────────────────────────
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'f8-cliente-a@example.com',
   '{"user_type":"client","full_name":"Cliente A"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'f8-cliente-b@example.com',
   '{"user_type":"client","full_name":"Cliente B"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', 'f8-lojista@example.com',
   '{"user_type":"merchant","full_name":"Lojista C"}', now(), now());

-- handle_new_user pode ou não criar o profile; garante as linhas.
INSERT INTO public.profiles (id, email, full_name, user_type)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'f8-cliente-a@example.com', 'Cliente A', 'client'),
  ('00000000-0000-4000-8000-0000000000b2', 'f8-cliente-b@example.com', 'Cliente B', 'client'),
  ('00000000-0000-4000-8000-0000000000c3', 'f8-lojista@example.com', 'Lojista C', 'merchant')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE f8_ids (k text PRIMARY KEY, v bigint) ON COMMIT DROP;
GRANT SELECT ON f8_ids TO authenticated;

WITH b AS (
  INSERT INTO public.business_profiles (owner_id, business_name)
  VALUES ('00000000-0000-4000-8000-0000000000c3', 'Negocio Teste F8')
  RETURNING id
)
INSERT INTO f8_ids SELECT 'business', id FROM b;

WITH s AS (
  INSERT INTO public.services (business_id, name, price, duration_minutes, location_type)
  SELECT v, 'Corte Teste F8', 65.00, 30, 'shop' FROM f8_ids WHERE k = 'business'
  RETURNING id
)
INSERT INTO f8_ids SELECT 'service', id FROM s;

WITH a AS (
  INSERT INTO public.appointments (business_id, client_id, service_id, start_time, end_time, status, payment_method)
  SELECT (SELECT v FROM f8_ids WHERE k = 'business'), '00000000-0000-4000-8000-0000000000a1',
         (SELECT v FROM f8_ids WHERE k = 'service'),
         now() + interval '2 days', now() + interval '2 days 30 minutes', 'pending', 'cash'
  RETURNING id
)
INSERT INTO f8_ids SELECT 'appt_cash', id FROM a;

WITH a AS (
  INSERT INTO public.appointments (business_id, client_id, service_id, start_time, end_time, status, payment_method)
  SELECT (SELECT v FROM f8_ids WHERE k = 'business'), '00000000-0000-4000-8000-0000000000a1',
         (SELECT v FROM f8_ids WHERE k = 'service'),
         now() + interval '3 days', now() + interval '3 days 30 minutes', 'pending', 'card'
  RETURNING id
)
INSERT INTO f8_ids SELECT 'appt_card', id FROM a;

WITH a AS (
  INSERT INTO public.appointments (business_id, client_id, service_id, start_time, end_time, status, payment_method, created_at)
  SELECT (SELECT v FROM f8_ids WHERE k = 'business'), '00000000-0000-4000-8000-0000000000a1',
         (SELECT v FROM f8_ids WHERE k = 'service'),
         now() + interval '4 days', now() + interval '4 days 30 minutes', 'pending', 'pix',
         now() - interval '1 hour'
  RETURNING id
)
INSERT INTO f8_ids SELECT 'appt_stale', id FROM a;

INSERT INTO public.payments (id, payer_id, purpose, appointment_id, merchant_business_id, method, status,
                             amount_cents, platform_fee_cents, funds_flow, idempotency_key)
SELECT '00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-0000000000a1', 'booking',
       (SELECT v FROM f8_ids WHERE k = 'appt_card'), (SELECT v FROM f8_ids WHERE k = 'business'),
       'card', 'succeeded', 6500, 650, 'destination', 'booking:test-f8-card';

INSERT INTO public.payments (id, payer_id, purpose, merchant_ref, method, status, amount_cents,
                             funds_flow, idempotency_key)
VALUES ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-0000000000b2', 'fura_fila', 'm1',
        'pix', 'processing', 1500, 'platform', 'chk_test_f8_b');

INSERT INTO public.payments (id, payer_id, purpose, appointment_id, merchant_business_id, method, status,
                             amount_cents, funds_flow, idempotency_key, created_at)
SELECT '00000000-0000-4000-8000-00000000f003', '00000000-0000-4000-8000-0000000000a1', 'booking',
       (SELECT v FROM f8_ids WHERE k = 'appt_stale'), (SELECT v FROM f8_ids WHERE k = 'business'),
       'pix', 'requires_action', 6500, 'platform', 'booking:test-f8-stale', now() - interval '1 hour';

INSERT INTO public.ledger_entries (account, business_id, kind, amount_cents, payment_id, title, subtitle)
SELECT 'merchant', v, 'service', 5850, '00000000-0000-4000-8000-00000000f001', 'Corte Teste F8', 'Cliente A'
FROM f8_ids WHERE k = 'business';
INSERT INTO public.ledger_entries (account, kind, amount_cents, payment_id, title, subtitle)
VALUES ('platform', 'platform_fee', 650, '00000000-0000-4000-8000-00000000f001', 'Taxa da plataforma', 'Corte Teste F8');
INSERT INTO public.ledger_entries (account, user_id, kind, amount_cents, title, subtitle)
VALUES ('client_qi', '00000000-0000-4000-8000-0000000000a1', 'qi_cashback', 650, 'Cashback', 'Teste');

-- ── Regras de integridade (como postgres) ───────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO public.payments (payer_id, purpose, appointment_id, merchant_business_id, method, status,
                                 amount_cents, funds_flow, idempotency_key)
    SELECT '00000000-0000-4000-8000-0000000000a1', 'booking', (SELECT v FROM f8_ids WHERE k = 'appt_card'),
           (SELECT v FROM f8_ids WHERE k = 'business'), 'pix', 'requires_action', 6500, 'platform', 'booking:dup';
    RAISE EXCEPTION 'FALHA: segunda cobranca viva para o mesmo agendamento foi aceita';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.ledger_entries (account, kind, amount_cents, payment_id, title, subtitle)
    VALUES ('platform', 'platform_fee', 650, '00000000-0000-4000-8000-00000000f001', 'dup', 'dup');
    RAISE EXCEPTION 'FALHA: lancamento duplicado (payment_id, account, kind) foi aceito';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Cobrança cancelada não conta como viva: o agendamento aceita outra.
  INSERT INTO public.payments (payer_id, purpose, appointment_id, merchant_business_id, method, status,
                               amount_cents, funds_flow, idempotency_key)
  SELECT '00000000-0000-4000-8000-0000000000a1', 'booking', (SELECT v FROM f8_ids WHERE k = 'appt_cash'),
         (SELECT v FROM f8_ids WHERE k = 'business'), 'card', 'canceled', 6500, 'destination', 'booking:canceled';

  IF public.payment_can_transition('succeeded', 'processing') THEN
    RAISE EXCEPTION 'FALHA: succeeded -> processing permitido';
  END IF;
  IF NOT public.payment_can_transition('succeeded', 'refunded') THEN
    RAISE EXCEPTION 'FALHA: succeeded -> refunded bloqueado';
  END IF;
  IF NOT public.payment_can_transition('failed', 'succeeded') THEN
    RAISE EXCEPTION 'FALHA: failed -> succeeded bloqueado (nova tentativa de cartao)';
  END IF;
  IF public.payment_can_transition('processing', 'requires_action') THEN
    RAISE EXCEPTION 'FALHA: processing -> requires_action permitido';
  END IF;
  IF public.payment_can_transition('canceled', 'succeeded') THEN
    RAISE EXCEPTION 'FALHA: canceled -> succeeded permitido';
  END IF;
END $$;

-- apply_payment_event e release_unpaid_appointments (service_role).
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE r jsonb; n int;
BEGIN
  r := public.apply_payment_event(
    '00000000-0000-4000-8000-00000000f002', 'succeeded',
    '{"provider_payment_id":"pi_test_f8_b"}'::jsonb,
    '[{"account":"platform","kind":"fura_fila","amount_cents":1500,"title":"Furou Fila","subtitle":"Cliente B"}]'::jsonb,
    false);
  IF NOT (r->>'applied')::boolean THEN RAISE EXCEPTION 'FALHA: apply_payment_event nao aplicou: %', r; END IF;

  r := public.apply_payment_event(
    '00000000-0000-4000-8000-00000000f002', 'processing', '{}'::jsonb, '[]'::jsonb, false);
  IF (r->>'applied')::boolean THEN RAISE EXCEPTION 'FALHA: evento atrasado voltou o status: %', r; END IF;

  -- Reaplicar o mesmo evento não duplica o ledger.
  r := public.apply_payment_event(
    '00000000-0000-4000-8000-00000000f002', 'succeeded', '{}'::jsonb,
    '[{"account":"platform","kind":"fura_fila","amount_cents":1500,"title":"Furou Fila","subtitle":"Cliente B"}]'::jsonb,
    false);
  SELECT count(*) INTO n FROM public.ledger_entries WHERE payment_id = '00000000-0000-4000-8000-00000000f002';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: ledger duplicado no reprocessamento (% linhas)', n; END IF;

  IF (SELECT paid_at FROM public.payments WHERE id = '00000000-0000-4000-8000-00000000f002') IS NULL THEN
    RAISE EXCEPTION 'FALHA: paid_at nao preenchido';
  END IF;
  IF (SELECT provider_payment_id FROM public.payments WHERE id = '00000000-0000-4000-8000-00000000f002')
     IS DISTINCT FROM 'pi_test_f8_b' THEN
    RAISE EXCEPTION 'FALHA: provider_payment_id nao gravado';
  END IF;

  -- Reserva Pix velha e não paga: cancela pagamento e agendamento; o resto fica.
  -- `n` conta o banco inteiro (reservas de QA fora deste teste também caem,
  -- e o ROLLBACK desfaz): as asserções abaixo olham só as linhas do teste.
  n := public.release_unpaid_appointments(interval '30 minutes');
  IF n < 1 THEN RAISE EXCEPTION 'FALHA: release_unpaid_appointments liberou % (esperado >= 1)', n; END IF;
  IF (SELECT status FROM public.appointments WHERE id = (SELECT v FROM f8_ids WHERE k = 'appt_stale')) <> 'canceled' THEN
    RAISE EXCEPTION 'FALHA: agendamento velho nao cancelado';
  END IF;
  IF (SELECT status FROM public.payments WHERE id = '00000000-0000-4000-8000-00000000f003') <> 'canceled' THEN
    RAISE EXCEPTION 'FALHA: pagamento velho nao cancelado';
  END IF;
  IF (SELECT status FROM public.appointments WHERE id = (SELECT v FROM f8_ids WHERE k = 'appt_card')) <> 'pending' THEN
    RAISE EXCEPTION 'FALHA: agendamento pago foi mexido';
  END IF;
END $$;
SELECT set_config('request.jwt.claims', '', true);

-- ── Cliente A ───────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int; masked text; r uuid;
BEGIN
  SELECT count(*) INTO n FROM public.payments WHERE payer_id <> auth.uid();
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: cliente A viu pagamento de outro'; END IF;
  SELECT count(*) INTO n FROM public.payments;
  IF n < 1 THEN RAISE EXCEPTION 'FALHA: cliente A nao ve os proprios pagamentos'; END IF;

  -- Escrita direta bloqueada.
  BEGIN
    INSERT INTO public.payments (payer_id, purpose, method, status, amount_cents, funds_flow, idempotency_key)
    VALUES (auth.uid(), 'fura_fila', 'card', 'succeeded', 100, 'platform', 'hack');
    RAISE EXCEPTION 'FALHA: authenticated inseriu em payments';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.payments SET status = 'refunded' WHERE payer_id = auth.uid();
    RAISE EXCEPTION 'FALHA: authenticated atualizou payments';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ledger_entries (account, user_id, kind, amount_cents, title, subtitle)
    VALUES ('client_qi', auth.uid(), 'qi_cashback', 99999, 'hack', 'hack');
    RAISE EXCEPTION 'FALHA: authenticated inseriu em ledger_entries';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.withdrawals (source, user_id, amount_cents, fee_cents, net_cents, status, idempotency_key)
    VALUES ('qi_client', auth.uid(), 3000, 500, 2500, 'paid', 'hack');
    RAISE EXCEPTION 'FALHA: authenticated inseriu em withdrawals';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.merchant_accounts (business_id, account_id) VALUES (1, 'acct_hack');
    RAISE EXCEPTION 'FALHA: authenticated inseriu em merchant_accounts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.stripe_events (id, type, endpoint) VALUES ('evt_hack', 'x', 'platform');
    RAISE EXCEPTION 'FALHA: authenticated inseriu em stripe_events';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.apply_payment_event('00000000-0000-4000-8000-00000000f001', 'refunded', '{}'::jsonb, '[]'::jsonb, false);
    RAISE EXCEPTION 'FALHA: authenticated chamou apply_payment_event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.release_unpaid_appointments(interval '0 minutes');
    RAISE EXCEPTION 'FALHA: authenticated chamou release_unpaid_appointments';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Ledger: só o client_qi próprio.
  SELECT count(*) INTO n FROM public.ledger_entries;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: cliente A deveria ver 1 lancamento (client_qi), viu %', n; END IF;
  IF public.my_qi_balance_cents() <> 650 THEN
    RAISE EXCEPTION 'FALHA: my_qi_balance_cents = %', public.my_qi_balance_cents();
  END IF;
  BEGIN
    PERFORM public.merchant_balance_cents((SELECT v FROM f8_ids WHERE k = 'business'), 'merchant');
    RAISE EXCEPTION 'FALHA: cliente leu saldo do lojista';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Chaves Pix: valor cru nunca volta.
  SELECT k.masked_value INTO masked FROM public.add_pix_key('cpf', '123.456.789-12') k;
  IF masked <> '*********-12' THEN RAISE EXCEPTION 'FALHA: mascara de cpf = %', masked; END IF;
  BEGIN
    PERFORM value FROM public.pix_keys;
    RAISE EXCEPTION 'FALHA: authenticated leu pix_keys.value';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT count(*) INTO n FROM public.my_pix_keys;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: my_pix_keys deveria ter 1 chave, tem %', n; END IF;
  BEGIN
    PERFORM public.add_pix_key('cpf', '123');
    RAISE EXCEPTION 'FALHA: cpf invalido aceito';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Pagar na hora: só o cliente do agendamento.
  r := public.record_pay_on_site((SELECT v FROM f8_ids WHERE k = 'appt_cash'));
  IF (SELECT status FROM public.payments WHERE id = r) <> 'pay_on_site' THEN
    RAISE EXCEPTION 'FALHA: record_pay_on_site nao gravou pay_on_site';
  END IF;
  IF (SELECT amount_cents FROM public.payments WHERE id = r) <> 6500 THEN
    RAISE EXCEPTION 'FALHA: record_pay_on_site com valor errado';
  END IF;
  IF public.record_pay_on_site((SELECT v FROM f8_ids WHERE k = 'appt_cash')) <> r THEN
    RAISE EXCEPTION 'FALHA: record_pay_on_site nao idempotente';
  END IF;
END $$;

-- ── Cliente B ───────────────────────────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.payments WHERE payer_id = '00000000-0000-4000-8000-0000000000a1';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: cliente B viu pagamentos do cliente A'; END IF;
  SELECT count(*) INTO n FROM public.my_pix_keys;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: cliente B viu chaves Pix do cliente A'; END IF;
  BEGIN
    PERFORM public.record_pay_on_site((SELECT v FROM f8_ids WHERE k = 'appt_card'));
    RAISE EXCEPTION 'FALHA: cliente B registrou pagamento no agendamento do cliente A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ── Lojista C ───────────────────────────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.payments
  WHERE merchant_business_id = (SELECT v FROM f8_ids WHERE k = 'business');
  IF n < 1 THEN RAISE EXCEPTION 'FALHA: lojista nao ve pagamentos do proprio negocio'; END IF;
  SELECT count(*) INTO n FROM public.payments WHERE purpose = 'fura_fila';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: lojista viu fura-fila de outro pagador'; END IF;
  SELECT count(*) INTO n FROM public.ledger_entries WHERE account = 'platform';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: lojista viu lancamentos da plataforma'; END IF;
  IF public.merchant_balance_cents((SELECT v FROM f8_ids WHERE k = 'business'), 'merchant') <> 5850 THEN
    RAISE EXCEPTION 'FALHA: merchant_balance_cents = %',
      public.merchant_balance_cents((SELECT v FROM f8_ids WHERE k = 'business'), 'merchant');
  END IF;
END $$;

RESET ROLE;
SELECT 'f8_payments_rls: ok' AS result;

ROLLBACK;
