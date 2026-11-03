-- Teste de begin_withdrawal / fail_withdrawal (migration 20261102140000_f8_withdraw_transfers.sql).
--
-- Roda dentro de BEGIN ... ROLLBACK: nada fica gravado. Dados 100% sintéticos.
-- Sucesso = devolve 'f8_withdrawals: ok'; cada asserção dá RAISE EXCEPTION.
-- Rodar pela Management API (POST /v1/projects/<ref>/database/query) com o
-- arquivo inteiro como `query`.

BEGIN;

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000d4', 'authenticated', 'authenticated', 'f8-wd-lojista@example.com',
   '{"user_type":"merchant","full_name":"Lojista WD"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000e5', 'authenticated', 'authenticated', 'f8-wd-cliente@example.com',
   '{"user_type":"client","full_name":"Cliente WD"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000f6', 'authenticated', 'authenticated', 'f8-wd-lojista2@example.com',
   '{"user_type":"merchant","full_name":"Lojista WD 2"}', now(), now());

CREATE TEMP TABLE f8_wd (k text PRIMARY KEY, v text) ON COMMIT DROP;

WITH b AS (
  INSERT INTO public.business_profiles (owner_id, business_name)
  VALUES ('00000000-0000-4000-8000-0000000000d4', 'Negocio WD F8') RETURNING id
)
INSERT INTO f8_wd SELECT 'biz', id::text FROM b;
WITH b AS (
  INSERT INTO public.business_profiles (owner_id, business_name)
  VALUES ('00000000-0000-4000-8000-0000000000f6', 'Negocio WD F8 sem cobranca') RETURNING id
)
INSERT INTO f8_wd SELECT 'biz2', id::text FROM b;

-- Três cobranças pagas na plataforma (3000, 4000, 5000), da mais antiga para a mais nova.
INSERT INTO public.payments (id, payer_id, purpose, merchant_business_id, method, status, amount_cents,
                             funds_flow, provider_payment_id, idempotency_key, paid_at)
SELECT ('00000000-0000-4000-8000-00000000f00' || n)::uuid, '00000000-0000-4000-8000-0000000000e5', 'booking',
       (SELECT v::bigint FROM f8_wd WHERE k = 'biz'), 'card', 'succeeded', amt, 'platform',
       'pi_f8_wd_' || n, 'f8-wd-pay-' || n, now() - make_interval(days => 10 - n)
FROM (VALUES (1, 3000), (2, 4000), (3, 5000)) AS t(n, amt);

INSERT INTO public.ledger_entries (account, kind, amount_cents, business_id, payment_id, title)
SELECT 'merchant', 'service', amount_cents, merchant_business_id, id, 'Corte'
FROM public.payments WHERE idempotency_key LIKE 'f8-wd-pay-%';

-- Saldo sem cobrança por trás (biz2) e saldo de QI do cliente.
INSERT INTO public.ledger_entries (account, kind, amount_cents, business_id, title)
SELECT 'merchant', 'service', 5000, v::bigint, 'Ajuste' FROM f8_wd WHERE k = 'biz2';
INSERT INTO public.ledger_entries (account, kind, amount_cents, user_id, title)
VALUES ('client_qi', 'qi_cashback', 5000, '00000000-0000-4000-8000-0000000000e5', 'Cashback');

CREATE FUNCTION pg_temp.wd(p_id text, p_source text, p_biz text, p_user text, p_amount int, p_fee int,
                           p_key text, p_status text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.begin_withdrawal(
    jsonb_build_object('id', p_id, 'source', p_source, 'business_id', p_biz, 'user_id', p_user,
                       'amount_cents', p_amount, 'fee_cents', p_fee, 'destination_label', 'Pix teste',
                       'idempotency_key', p_key, 'status', p_status),
    jsonb_build_array(
      jsonb_build_object('account', CASE p_source WHEN 'qi_client' THEN 'client_qi' ELSE 'merchant' END,
                         'kind', CASE p_source WHEN 'qi_client' THEN 'qi_withdraw' ELSE 'withdraw' END,
                         'amount_cents', -p_amount, 'business_id', p_biz, 'user_id',
                         CASE p_source WHEN 'qi_client' THEN p_user END,
                         'title', 'Saque', 'subtitle', 'Pix teste'),
      jsonb_build_object('account', 'platform', 'kind', 'withdraw_fee', 'amount_cents', p_fee,
                         'title', 'Taxa de saque', 'subtitle', 'Saque')
    )
  );
$$;

DO $$
DECLARE
  v_biz  text := (SELECT v FROM f8_wd WHERE k = 'biz');
  v_biz2 text := (SELECT v FROM f8_wd WHERE k = 'biz2');
  v_u    text := '00000000-0000-4000-8000-0000000000d4';
  v_c    text := '00000000-0000-4000-8000-0000000000e5';
  r      jsonb;
  v_n    int;
  v_bal  bigint;
BEGIN
  -- 1. Saque de 10000 (líquido 9500): consome 3000 + 4000 + 2500, mais antigas primeiro.
  r := pg_temp.wd('00000000-0000-4000-8000-0000000a0001', 'financeiro', v_biz, v_u, 10000, 500, 'wd-1', 'processing');
  IF (r->>'existing')::boolean OR r->>'status' <> 'processing' THEN
    RAISE EXCEPTION 'wd-1: retorno inesperado %', r;
  END IF;
  IF (SELECT array_agg((t->>'amount_cents')::int ORDER BY (t->>'id')::bigint)
      FROM jsonb_array_elements(r->'transfers') t) <> ARRAY[3000, 4000, 2500] THEN
    RAISE EXCEPTION 'wd-1: alocação errada %', r->'transfers';
  END IF;
  IF (SELECT array_agg(t->>'provider_payment_id' ORDER BY (t->>'id')::bigint)
      FROM jsonb_array_elements(r->'transfers') t) <> ARRAY['pi_f8_wd_1', 'pi_f8_wd_2', 'pi_f8_wd_3'] THEN
    RAISE EXCEPTION 'wd-1: ordem errada %', r->'transfers';
  END IF;

  -- 2. Mesma chave: devolve o existente, sem debitar de novo.
  r := pg_temp.wd('00000000-0000-4000-8000-0000000a0099', 'financeiro', v_biz, v_u, 10000, 500, 'wd-1', 'processing');
  IF NOT (r->>'existing')::boolean OR r->>'withdrawal_id' <> '00000000-0000-4000-8000-0000000a0001' THEN
    RAISE EXCEPTION 'wd-1 repetido: %', r;
  END IF;
  SELECT count(*) INTO v_n FROM ledger_entries WHERE withdrawal_id = '00000000-0000-4000-8000-0000000a0001';
  IF v_n <> 2 THEN RAISE EXCEPTION 'wd-1 repetido duplicou o ledger (% linhas)', v_n; END IF;

  -- 3. Mesma chave com outro valor: recusa.
  BEGIN
    PERFORM pg_temp.wd('00000000-0000-4000-8000-0000000a0098', 'financeiro', v_biz, v_u, 9000, 500, 'wd-1', 'processing');
    RAISE EXCEPTION 'wd-1 com outro valor deveria falhar';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'idempotency_key_reused' THEN RAISE; END IF;
  END;

  -- 4. Saque de 2000 (líquido 1500): sobra da terceira cobrança.
  r := pg_temp.wd('00000000-0000-4000-8000-0000000a0002', 'financeiro', v_biz, v_u, 2000, 500, 'wd-2', 'processing');
  IF jsonb_array_length(r->'transfers') <> 1
     OR (r->'transfers'->0->>'amount_cents')::int <> 1500
     OR r->'transfers'->0->>'provider_payment_id' <> 'pi_f8_wd_3' THEN
    RAISE EXCEPTION 'wd-2: alocação errada %', r->'transfers';
  END IF;

  -- 5. Saldo zerado: insufficient_balance, sem gravar nada.
  BEGIN
    PERFORM pg_temp.wd('00000000-0000-4000-8000-0000000a0003', 'financeiro', v_biz, v_u, 1000, 500, 'wd-3', 'processing');
    RAISE EXCEPTION 'wd-3 deveria falhar por saldo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'insufficient_balance' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM withdrawals WHERE idempotency_key = 'wd-3') THEN
    RAISE EXCEPTION 'wd-3 gravou o saque';
  END IF;

  -- 6. fail_withdrawal do wd-2: estorna o ledger e libera a alocação.
  r := public.fail_withdrawal('00000000-0000-4000-8000-0000000a0002', 'test_failure');
  IF NOT (r->>'changed')::boolean THEN RAISE EXCEPTION 'fail wd-2: %', r; END IF;
  SELECT coalesce(sum(amount_cents), 0) INTO v_bal FROM ledger_entries
  WHERE business_id = v_biz::bigint AND account = 'merchant';
  IF v_bal <> 2000 THEN RAISE EXCEPTION 'fail wd-2: saldo % (esperado 2000)', v_bal; END IF;
  IF (SELECT status FROM withdrawals WHERE id = '00000000-0000-4000-8000-0000000a0002') <> 'failed' THEN
    RAISE EXCEPTION 'fail wd-2: status';
  END IF;
  r := public.fail_withdrawal('00000000-0000-4000-8000-0000000a0002', 'test_failure');
  IF (r->>'changed')::boolean THEN RAISE EXCEPTION 'fail wd-2 não é idempotente'; END IF;
  SELECT coalesce(sum(amount_cents), 0) INTO v_bal FROM ledger_entries
  WHERE business_id = v_biz::bigint AND account = 'merchant';
  IF v_bal <> 2000 THEN RAISE EXCEPTION 'fail wd-2 repetido mexeu no saldo (%)', v_bal; END IF;

  -- 7. Alocação liberada: novo saque volta a usar a terceira cobrança.
  r := pg_temp.wd('00000000-0000-4000-8000-0000000a0004', 'financeiro', v_biz, v_u, 2000, 500, 'wd-4', 'processing');
  IF (r->'transfers'->0->>'amount_cents')::int <> 1500 THEN
    RAISE EXCEPTION 'wd-4: alocação não foi liberada %', r->'transfers';
  END IF;

  -- 8. Com um transfer já feito, fail_withdrawal não estorna.
  UPDATE payment_transfers SET status = 'succeeded', provider_transfer_id = 'tr_f8_wd_1'
  WHERE withdrawal_id = '00000000-0000-4000-8000-0000000a0001' AND amount_cents = 3000;
  r := public.fail_withdrawal('00000000-0000-4000-8000-0000000a0001', 'test_failure');
  IF (r->>'failed')::boolean OR (r->>'changed')::boolean THEN
    RAISE EXCEPTION 'fail wd-1 com transfer feito: %', r;
  END IF;

  -- 9. Saldo sem cobrança por trás: no_transfer_source e nada gravado.
  BEGIN
    PERFORM pg_temp.wd('00000000-0000-4000-8000-0000000a0005', 'financeiro', v_biz2, '00000000-0000-4000-8000-0000000000f6', 3000, 500, 'wd-5', 'processing');
    RAISE EXCEPTION 'wd-5 deveria falhar sem cobrança';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'no_transfer_source' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM withdrawals WHERE idempotency_key = 'wd-5')
     OR EXISTS (SELECT 1 FROM ledger_entries WHERE withdrawal_id = '00000000-0000-4000-8000-0000000a0005') THEN
    RAISE EXCEPTION 'wd-5 gravou dados apesar da exceção';
  END IF;

  -- 10. QI do cliente: manual_pending, sem transfer.
  r := pg_temp.wd('00000000-0000-4000-8000-0000000a0006', 'qi_client', NULL, v_c, 3000, 500, 'wd-6', 'manual_pending');
  IF r->>'status' <> 'manual_pending' OR jsonb_array_length(r->'transfers') <> 0 THEN
    RAISE EXCEPTION 'wd-6: %', r;
  END IF;
  SELECT coalesce(sum(amount_cents), 0) INTO v_bal FROM ledger_entries
  WHERE user_id = v_c::uuid AND account = 'client_qi';
  IF v_bal <> 2000 THEN RAISE EXCEPTION 'wd-6: saldo QI % (esperado 2000)', v_bal; END IF;

  -- 11. Só o service role executa as RPCs.
  IF has_function_privilege('authenticated', 'public.begin_withdrawal(jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fail_withdrawal(uuid, text)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.payment_transfers', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated não deveria acessar as RPCs ou payment_transfers';
  END IF;
END;
$$;

SELECT 'f8_withdrawals: ok' AS result;

ROLLBACK;
