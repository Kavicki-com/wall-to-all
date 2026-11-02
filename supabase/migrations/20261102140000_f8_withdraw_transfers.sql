-- F8: saque por transfers alocados sobre cobranças (design § 16, decisão de 02/11).
-- A plataforma segura os fundos; cada saque vira um ou mais transfers para a
-- conta conectada, cada um com `source_transaction` numa cobrança (exigência
-- da Stripe no BR). Esta migration registra quanto de cada cobrança já foi
-- repassado e faz a alocação e o débito numa transação só.
-- Teste: supabase/tests/f8_withdrawals.sql (BEGIN ... ROLLBACK).

CREATE TYPE public.payment_transfer_status AS ENUM ('pending', 'succeeded', 'failed');

-- Parte de uma cobrança repassada num saque.
CREATE TABLE public.payment_transfers (
  id                   bigserial PRIMARY KEY,
  withdrawal_id        uuid NOT NULL REFERENCES public.withdrawals (id),
  payment_id           uuid NOT NULL REFERENCES public.payments (id),
  amount_cents         integer NOT NULL CHECK (amount_cents > 0),
  status               public.payment_transfer_status NOT NULL DEFAULT 'pending',
  provider_transfer_id text UNIQUE,
  failure_code         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (withdrawal_id, payment_id)
);
CREATE TRIGGER payment_transfers_touch_updated_at
  BEFORE UPDATE ON public.payment_transfers
  FOR EACH ROW EXECUTE FUNCTION public.f8_touch_updated_at();
CREATE INDEX payment_transfers_payment_live_idx
  ON public.payment_transfers (payment_id) WHERE status <> 'failed';

-- Só o service role (Edge Function) lê e escreve.
ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_transfers FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.payment_transfers_id_seq FROM anon, authenticated;

-- Abre um saque: confere o saldo, grava o saque e o ledger e, quando há
-- transfer, aloca o líquido sobre as cobranças mais antigas ainda não
-- repassadas. Tudo sob um lock global (volume do piloto é baixo, e o QI do
-- lojista aloca sobre cobranças de qualquer negócio).
--   p_withdrawal: {id, source, business_id?, user_id, amount_cents, fee_cents,
--                  pix_key_id?, destination_label, idempotency_key, status}
--   p_ledger: [{account, kind, amount_cents, business_id?, user_id?, title, subtitle}]
-- Repetir com a mesma idempotency_key devolve o saque existente
-- (`existing: true`) sem debitar de novo.
-- Exceções (mensagem): insufficient_balance, no_transfer_source,
-- idempotency_key_reused.
CREATE OR REPLACE FUNCTION public.begin_withdrawal(p_withdrawal jsonb, p_ledger jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id          uuid := (p_withdrawal->>'id')::uuid;
  v_source      public.withdrawal_source := (p_withdrawal->>'source')::public.withdrawal_source;
  v_business_id bigint := (p_withdrawal->>'business_id')::bigint;
  v_user_id     uuid := (p_withdrawal->>'user_id')::uuid;
  v_amount      integer := (p_withdrawal->>'amount_cents')::integer;
  v_fee         integer := (p_withdrawal->>'fee_cents')::integer;
  v_net         integer := v_amount - v_fee;
  v_key         text := p_withdrawal->>'idempotency_key';
  v_status      public.withdrawal_status := (p_withdrawal->>'status')::public.withdrawal_status;
  v_existing    withdrawals%ROWTYPE;
  v_balance     bigint;
  v_allocated   bigint;
  v_existed     boolean := false;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('f8_withdraw'));

  SELECT * INTO v_existing FROM withdrawals WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM v_user_id
       OR v_existing.source <> v_source
       OR v_existing.amount_cents <> v_amount THEN
      RAISE EXCEPTION 'idempotency_key_reused';
    END IF;
    v_id := v_existing.id;
    v_existed := true;
  ELSE
    IF v_source = 'qi_client' THEN
      SELECT coalesce(sum(amount_cents), 0) INTO v_balance
      FROM ledger_entries WHERE user_id = v_user_id AND account = 'client_qi';
    ELSE
      SELECT coalesce(sum(amount_cents), 0) INTO v_balance
      FROM ledger_entries
      WHERE business_id = v_business_id
        AND account = (CASE WHEN v_source = 'financeiro' THEN 'merchant' ELSE 'merchant_qi' END)::public.ledger_account;
    END IF;
    IF v_balance < v_amount THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;

    INSERT INTO withdrawals (id, source, business_id, user_id, amount_cents, fee_cents, net_cents,
                             pix_key_id, destination_label, status, idempotency_key)
    VALUES (v_id, v_source, v_business_id, v_user_id, v_amount, v_fee, v_net,
            (p_withdrawal->>'pix_key_id')::uuid, p_withdrawal->>'destination_label', v_status, v_key);

    INSERT INTO ledger_entries (account, kind, amount_cents, business_id, user_id, withdrawal_id, title, subtitle)
    SELECT (e->>'account')::public.ledger_account,
           (e->>'kind')::public.ledger_kind,
           (e->>'amount_cents')::integer,
           (e->>'business_id')::bigint,
           (e->>'user_id')::uuid,
           v_id,
           e->>'title',
           coalesce(e->>'subtitle', '')
    FROM jsonb_array_elements(p_ledger) AS e;

    IF v_status = 'processing' THEN
      -- Financeiro: só cobranças do próprio negócio, até o líquido do lojista.
      -- QI do lojista: cobranças da plataforma (o cashback é custo dela),
      -- primeiro as que não são de negócio nenhum (fura-fila).
      WITH cand AS (
        SELECT p.id,
               p.paid_at,
               (p.merchant_business_id IS NOT NULL) AS has_merchant,
               (CASE WHEN v_source = 'financeiro' THEN p.amount_cents - p.platform_fee_cents
                     ELSE p.amount_cents END)
                 - coalesce((SELECT sum(t.amount_cents) FROM payment_transfers t
                             WHERE t.payment_id = p.id AND t.status <> 'failed'), 0) AS avail
        FROM payments p
        WHERE p.status = 'succeeded'
          AND p.funds_flow = 'platform'
          AND p.provider_payment_id IS NOT NULL
          AND (v_source <> 'financeiro' OR p.merchant_business_id = v_business_id)
      ), ordered AS (
        SELECT id, avail,
               sum(avail) OVER (
                 ORDER BY CASE WHEN v_source = 'financeiro' THEN false ELSE has_merchant END,
                          paid_at, id
               ) AS running
        FROM cand WHERE avail > 0
      )
      INSERT INTO payment_transfers (withdrawal_id, payment_id, amount_cents)
      SELECT v_id, id, least(avail, v_net - (running - avail))::integer
      FROM ordered
      WHERE running - avail < v_net;

      SELECT coalesce(sum(amount_cents), 0) INTO v_allocated
      FROM payment_transfers WHERE withdrawal_id = v_id;
      IF v_allocated <> v_net THEN
        RAISE EXCEPTION 'no_transfer_source';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'withdrawal_id', v_id,
    'existing', v_existed,
    'status', (SELECT status FROM withdrawals WHERE id = v_id),
    'transfers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', t.id,
               'payment_id', t.payment_id,
               'provider_payment_id', p.provider_payment_id,
               'amount_cents', t.amount_cents,
               'status', t.status,
               'provider_transfer_id', t.provider_transfer_id
             ) ORDER BY t.id)
      FROM payment_transfers t JOIN payments p ON p.id = t.payment_id
      WHERE t.withdrawal_id = v_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.begin_withdrawal(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_withdrawal(jsonb, jsonb) TO service_role;

-- Saque que não conseguiu transferir nada: marca `failed`, libera as
-- alocações e estorna o ledger (espelho com sinal invertido, kind `refund`).
-- Com algum transfer já feito não falha (o retry com a mesma chave retoma).
-- Idempotente.
CREATE OR REPLACE FUNCTION public.fail_withdrawal(p_withdrawal_id uuid, p_failure_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.withdrawal_status;
BEGIN
  SELECT status INTO v_status FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque % inexistente.', p_withdrawal_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_status = 'failed' THEN
    RETURN jsonb_build_object('failed', true, 'changed', false);
  END IF;
  IF v_status = 'paid' OR EXISTS (
    SELECT 1 FROM payment_transfers WHERE withdrawal_id = p_withdrawal_id AND status = 'succeeded'
  ) THEN
    RETURN jsonb_build_object('failed', false, 'changed', false);
  END IF;

  UPDATE payment_transfers SET status = 'failed', failure_code = p_failure_code
  WHERE withdrawal_id = p_withdrawal_id AND status = 'pending';
  UPDATE withdrawals SET status = 'failed', failure_code = p_failure_code
  WHERE id = p_withdrawal_id;

  INSERT INTO ledger_entries (account, kind, amount_cents, business_id, user_id, withdrawal_id, title, subtitle)
  SELECT account, 'refund', -amount_cents, business_id, user_id, withdrawal_id, 'Estorno', title
  FROM ledger_entries
  WHERE withdrawal_id = p_withdrawal_id AND kind <> 'refund'
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('failed', true, 'changed', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fail_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_withdrawal(uuid, text) TO service_role;
