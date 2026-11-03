-- F8: pagamentos reais (Stripe em test mode). Tabelas, enums, RLS e RPCs.
-- Design: docs/plans/2026-11-02-f8-pagamentos-stripe-design.md (§ 5, § 7, § 10, § 11).
-- Teste: supabase/tests/f8_payments_rls.sql (BEGIN ... ROLLBACK).
--
-- Regras gerais:
--  * Nomes neutros de PSP (`provider*`): a troca de PSP na produção não exige
--    migration destrutiva.
--  * Valores em centavos (integer), moeda BRL.
--  * Escrita só pelo service role (Edge Functions) ou por RPC security definer;
--    o app (authenticated) só LÊ o que é dele. As permissões de escrita são
--    revogadas explicitamente porque o Supabase concede ALL em tabelas novas
--    para anon/authenticated por default privileges.
--  * Funções security definer seguem 20260706120000_security_hardening.sql:
--    search_path fixo e EXECUTE revogado de PUBLIC/anon (e de authenticated
--    quando a função é só do servidor).

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE public.payment_purpose AS ENUM ('booking', 'fura_fila', 'subscription');
CREATE TYPE public.payment_status AS ENUM (
  'requires_payment', 'requires_action', 'processing',
  'succeeded', 'failed', 'canceled', 'refunded', 'pay_on_site'
);
CREATE TYPE public.funds_flow AS ENUM ('destination', 'platform', 'none');
CREATE TYPE public.ledger_account AS ENUM ('merchant', 'merchant_qi', 'client_qi', 'platform');
CREATE TYPE public.ledger_kind AS ENUM (
  'service', 'fura_fila', 'platform_fee', 'withdraw', 'withdraw_fee',
  'qi_cashback', 'qi_withdraw', 'refund'
);
CREATE TYPE public.withdrawal_source AS ENUM ('financeiro', 'qi_merchant', 'qi_client');
CREATE TYPE public.withdrawal_status AS ENUM ('requested', 'processing', 'paid', 'failed', 'manual_pending');
CREATE TYPE public.pix_key_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');

-- ── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.f8_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.f8_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- ── Tabelas ─────────────────────────────────────────────────────────────────

-- Customer do PSP por usuário (cartões salvos).
CREATE TABLE public.psp_customers (
  user_id     uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  provider    text NOT NULL DEFAULT 'stripe',
  customer_id text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Conta conectada (recebedor) por negócio.
CREATE TABLE public.merchant_accounts (
  business_id       bigint PRIMARY KEY REFERENCES public.business_profiles (id) ON DELETE CASCADE,
  provider          text NOT NULL DEFAULT 'stripe',
  account_id        text NOT NULL UNIQUE,
  charges_enabled   boolean NOT NULL DEFAULT false,
  payouts_enabled   boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  requirements_due  jsonb NOT NULL DEFAULT '[]'::jsonb,
  disconnected_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER merchant_accounts_touch_updated_at
  BEFORE UPDATE ON public.merchant_accounts
  FOR EACH ROW EXECUTE FUNCTION public.f8_touch_updated_at();

-- Uma linha por cobrança (ou por "pagar na hora").
CREATE TABLE public.payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Registro financeiro sobrevive à exclusão da conta: o vínculo vira null.
  payer_id             uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  purpose              public.payment_purpose NOT NULL,
  appointment_id       bigint REFERENCES public.appointments (id) ON DELETE SET NULL,
  merchant_business_id bigint REFERENCES public.business_profiles (id) ON DELETE SET NULL,
  -- Fura-fila: id do lojista na fila mock (m1...), sem negócio real por trás.
  merchant_ref         text,
  method               public.payment_method NOT NULL,
  status               public.payment_status NOT NULL DEFAULT 'requires_payment',
  amount_cents         integer NOT NULL CHECK (amount_cents > 0),
  platform_fee_cents   integer NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  funds_flow           public.funds_flow NOT NULL,
  provider             text,
  provider_payment_id  text UNIQUE,
  idempotency_key      text NOT NULL UNIQUE,
  confirm_attempts     integer NOT NULL DEFAULT 0,
  card_last4           text CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  card_brand           text,
  failure_code         text,
  paid_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (platform_fee_cents <= amount_cents)
);
CREATE TRIGGER payments_touch_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.f8_touch_updated_at();

-- Uma cobrança viva por agendamento (cancelada/falha não conta).
CREATE UNIQUE INDEX payments_one_live_per_appointment
  ON public.payments (appointment_id)
  WHERE purpose = 'booking' AND status NOT IN ('canceled', 'failed');
CREATE INDEX payments_appointment_idx ON public.payments (appointment_id);
CREATE INDEX payments_payer_created_idx ON public.payments (payer_id, created_at DESC);
CREATE INDEX payments_merchant_created_idx
  ON public.payments (merchant_business_id, created_at DESC)
  WHERE merchant_business_id IS NOT NULL;

-- Chaves Pix. O valor cru só é lido pelo service role (grant por coluna abaixo).
CREATE TABLE public.pix_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type         public.pix_key_type NOT NULL,
  value        text NOT NULL,
  masked_value text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pix_keys_user_idx ON public.pix_keys (user_id);

-- Saques (Financeiro, QI do lojista, QI do cliente).
CREATE TABLE public.withdrawals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source               public.withdrawal_source NOT NULL,
  business_id          bigint REFERENCES public.business_profiles (id) ON DELETE SET NULL,
  user_id              uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  amount_cents         integer NOT NULL CHECK (amount_cents > 0),
  fee_cents            integer NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  net_cents            integer NOT NULL CHECK (net_cents > 0),
  -- Só rótulo: a Stripe paga na conta bancária do onboarding, não na chave.
  pix_key_id           uuid REFERENCES public.pix_keys (id) ON DELETE SET NULL,
  destination_label    text,
  status               public.withdrawal_status NOT NULL DEFAULT 'requested',
  provider_transfer_id text,
  provider_payout_id   text,
  provider_reversal_id text,
  idempotency_key      text NOT NULL UNIQUE,
  failure_code         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (net_cents = amount_cents - fee_cents)
);
CREATE TRIGGER withdrawals_touch_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.f8_touch_updated_at();
CREATE INDEX withdrawals_user_created_idx ON public.withdrawals (user_id, created_at DESC);
CREATE INDEX withdrawals_business_idx ON public.withdrawals (business_id);
CREATE INDEX withdrawals_pix_key_idx ON public.withdrawals (pix_key_id);

-- Ledger: fonte do saldo do lojista e do QI. Lançamentos com sinal.
CREATE TABLE public.ledger_entries (
  id            bigserial PRIMARY KEY,
  account       public.ledger_account NOT NULL,
  business_id   bigint REFERENCES public.business_profiles (id) ON DELETE SET NULL,
  user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  kind          public.ledger_kind NOT NULL,
  amount_cents  integer NOT NULL CHECK (amount_cents <> 0),
  payment_id    uuid REFERENCES public.payments (id),
  withdrawal_id uuid REFERENCES public.withdrawals (id),
  title         text NOT NULL,
  subtitle      text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, account, kind),
  UNIQUE (withdrawal_id, account, kind)
);
CREATE INDEX ledger_business_account_created_idx
  ON public.ledger_entries (business_id, account, created_at DESC);
CREATE INDEX ledger_user_account_idx
  ON public.ledger_entries (user_id, account)
  WHERE user_id IS NOT NULL;

-- Eventos de webhook já recebidos (dedupe). Só service role.
CREATE TABLE public.stripe_events (
  id           text PRIMARY KEY,
  type         text NOT NULL,
  endpoint     text NOT NULL CHECK (endpoint IN ('platform', 'connect')),
  livemode     boolean NOT NULL DEFAULT false,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error        text
);

-- ── Permissões e RLS ────────────────────────────────────────────────────────
ALTER TABLE public.psp_customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.psp_customers, public.merchant_accounts, public.payments, public.pix_keys,
              public.withdrawals, public.ledger_entries, public.stripe_events
  FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.ledger_entries_id_seq FROM anon, authenticated;

GRANT SELECT ON public.psp_customers, public.merchant_accounts, public.payments,
                public.withdrawals, public.ledger_entries
  TO authenticated;
-- pix_keys: tudo menos o valor cru.
GRANT SELECT (id, user_id, type, masked_value, created_at) ON public.pix_keys TO authenticated;

CREATE POLICY psp_customers_select_own ON public.psp_customers
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY merchant_accounts_select_owner ON public.merchant_accounts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_profiles b
    WHERE b.id = merchant_accounts.business_id AND b.owner_id = (SELECT auth.uid())
  ));

CREATE POLICY payments_select_payer_or_merchant ON public.payments
  FOR SELECT TO authenticated
  USING (
    payer_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.business_profiles b
      WHERE b.id = payments.merchant_business_id AND b.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY pix_keys_select_own ON public.pix_keys
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY withdrawals_select_own ON public.withdrawals
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY ledger_entries_select_owner ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (
    (account IN ('merchant', 'merchant_qi') AND EXISTS (
      SELECT 1 FROM public.business_profiles b
      WHERE b.id = ledger_entries.business_id AND b.owner_id = (SELECT auth.uid())
    ))
    OR (account = 'client_qi' AND user_id = (SELECT auth.uid()))
  );

-- stripe_events: sem policy (só service role).

-- Leitura das chaves Pix pelo app: sem o valor cru. security_invoker mantém a
-- RLS de pix_keys valendo (sem view security definer).
CREATE VIEW public.my_pix_keys WITH (security_invoker = true) AS
  SELECT id, type, masked_value, created_at
  FROM public.pix_keys
  WHERE user_id = (SELECT auth.uid());
REVOKE ALL ON public.my_pix_keys FROM anon, authenticated;
GRANT SELECT ON public.my_pix_keys TO authenticated;

-- ── Funções ─────────────────────────────────────────────────────────────────

-- Espelho SQL de canTransition (supabase/functions/_shared/statusMap.ts).
CREATE OR REPLACE FUNCTION public.payment_can_transition(p_from public.payment_status, p_to public.payment_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_from = p_to THEN false
    WHEN p_from IN ('canceled', 'refunded', 'pay_on_site') THEN false
    WHEN p_to = 'pay_on_site' THEN false
    WHEN p_from = 'succeeded' THEN p_to = 'refunded'
    WHEN p_to = 'refunded' THEN false
    WHEN p_from = 'failed' THEN true
    WHEN p_to IN ('succeeded', 'failed', 'canceled') THEN true
    ELSE coalesce(
      array_position(ARRAY['requires_payment', 'requires_action', 'processing']::public.payment_status[], p_to)
      > array_position(ARRAY['requires_payment', 'requires_action', 'processing']::public.payment_status[], p_from),
      false)
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.payment_can_transition(public.payment_status, public.payment_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_can_transition(public.payment_status, public.payment_status) TO authenticated, service_role;

-- Saldo do lojista (conta merchant ou merchant_qi). Só o dono ou o service role.
CREATE OR REPLACE FUNCTION public.merchant_balance_cents(
  p_business_id bigint,
  p_account public.ledger_account DEFAULT 'merchant'
) RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_account NOT IN ('merchant', 'merchant_qi') THEN
    RAISE EXCEPTION 'Conta de ledger inválida para lojista: %', p_account USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM business_profiles WHERE id = p_business_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para o saldo deste negócio.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT sum(amount_cents) FROM ledger_entries
    WHERE business_id = p_business_id AND account = p_account
  ), 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.merchant_balance_cents(bigint, public.ledger_account) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_balance_cents(bigint, public.ledger_account) TO authenticated, service_role;

-- Saldo do QI do cliente logado.
CREATE OR REPLACE FUNCTION public.my_qi_balance_cents()
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT sum(amount_cents) FROM ledger_entries
    WHERE user_id = auth.uid() AND account = 'client_qi'
  ), 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.my_qi_balance_cents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_qi_balance_cents() TO authenticated, service_role;

-- Aplica um evento do PSP: transição de status (só avança) + lançamentos, numa
-- transação. Chamada pelo webhook com service role. Reprocessar o mesmo evento
-- é seguro: transição repetida é no-op e o ledger tem unique por
-- (payment_id, account, kind).
--   p_fields: provider_payment_id, card_last4, card_brand, failure_code (opcionais)
--   p_ledger: [{account, kind, amount_cents, business_id?, user_id?, withdrawal_id?, title, subtitle}]
CREATE OR REPLACE FUNCTION public.apply_payment_event(
  p_payment_id uuid,
  p_status public.payment_status,
  p_fields jsonb DEFAULT '{}'::jsonb,
  p_ledger jsonb DEFAULT '[]'::jsonb,
  p_cancel_appointment boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current public.payment_status;
  v_appointment_id bigint;
  v_applied boolean := false;
BEGIN
  SELECT status, appointment_id INTO v_current, v_appointment_id
  FROM payments WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento % inexistente.', p_payment_id USING ERRCODE = 'no_data_found';
  END IF;

  IF payment_can_transition(v_current, p_status) THEN
    UPDATE payments SET
      status = p_status,
      provider_payment_id = coalesce(p_fields->>'provider_payment_id', provider_payment_id),
      card_last4 = coalesce(p_fields->>'card_last4', card_last4),
      card_brand = coalesce(p_fields->>'card_brand', card_brand),
      failure_code = CASE WHEN p_status = 'failed' THEN p_fields->>'failure_code' ELSE failure_code END,
      paid_at = CASE WHEN p_status = 'succeeded' THEN coalesce(paid_at, now()) ELSE paid_at END
    WHERE id = p_payment_id;
    v_applied := true;

    IF p_cancel_appointment AND v_appointment_id IS NOT NULL THEN
      UPDATE appointments SET status = 'canceled', updated_at = now()
      WHERE id = v_appointment_id AND status = 'pending';
    END IF;
  END IF;

  -- Ledger só quando o evento valeu (ou é a repetição do estado atual, em que
  -- o unique descarta o que já existe). Evento atrasado não lança nada.
  IF v_applied OR v_current = p_status THEN
    INSERT INTO ledger_entries (account, kind, amount_cents, business_id, user_id, payment_id, withdrawal_id, title, subtitle)
    SELECT (e->>'account')::public.ledger_account,
           (e->>'kind')::public.ledger_kind,
           (e->>'amount_cents')::integer,
           (e->>'business_id')::bigint,
           (e->>'user_id')::uuid,
           p_payment_id,
           (e->>'withdrawal_id')::uuid,
           e->>'title',
           coalesce(e->>'subtitle', '')
    FROM jsonb_array_elements(p_ledger) AS e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'applied', v_applied,
    'previous_status', v_current,
    'status', CASE WHEN v_applied THEN p_status ELSE v_current END
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_payment_event(uuid, public.payment_status, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_event(uuid, public.payment_status, jsonb, jsonb, boolean) TO service_role;

-- Libera reservas com cobrança online não paga além do prazo (design § 7).
-- Só olha agendamentos que TÊM linha em payments: com o provider mock a F5
-- continua criando agendamentos pending sem cobrança, e esses não podem cair.
-- `processing` fica de fora (dinheiro em trânsito).
CREATE OR REPLACE FUNCTION public.release_unpaid_appointments(p_older_than interval DEFAULT interval '30 minutes')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  WITH stale AS (
    SELECT p.id AS payment_id, p.appointment_id
    FROM payments p
    JOIN appointments a ON a.id = p.appointment_id
    WHERE p.purpose = 'booking'
      AND p.status IN ('requires_payment', 'requires_action', 'failed')
      AND p.created_at < now() - p_older_than
      AND a.status = 'pending'
    FOR UPDATE OF p, a
  ), canceled_payments AS (
    UPDATE payments SET status = 'canceled'
    WHERE id IN (SELECT payment_id FROM stale)
    RETURNING appointment_id
  )
  UPDATE appointments SET status = 'canceled', updated_at = now()
  WHERE id IN (SELECT appointment_id FROM canceled_payments) AND status = 'pending';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.release_unpaid_appointments(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_unpaid_appointments(interval) TO service_role;

-- "Pagar na hora": único caminho de escrita do app em payments. Só o cliente do
-- agendamento; valor vem de services.price. Idempotente por agendamento.
CREATE OR REPLACE FUNCTION public.record_pay_on_site(p_appointment_id bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id uuid;
  v_business_id bigint;
  v_method public.payment_method;
  v_price numeric;
  v_key text := 'booking:' || p_appointment_id || ':on_site';
  v_id uuid;
BEGIN
  SELECT a.client_id, a.business_id, a.payment_method, s.price
    INTO v_client_id, v_business_id, v_method, v_price
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND OR auth.uid() IS NULL OR v_client_id <> auth.uid() THEN
    RAISE EXCEPTION 'Agendamento não pertence ao usuário.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_id FROM payments WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  INSERT INTO payments (payer_id, purpose, appointment_id, merchant_business_id, method, status,
                        amount_cents, funds_flow, idempotency_key)
  VALUES (auth.uid(), 'booking', p_appointment_id, v_business_id, coalesce(v_method, 'cash'), 'pay_on_site',
          round(v_price * 100)::integer, 'none', v_key)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_pay_on_site(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pay_on_site(bigint) TO authenticated, service_role;

-- Cadastro de chave Pix: valida e mascara no servidor (mesma regra de
-- maskPixValue em lib/services/mock/mockWalletService.ts). Devolve só o mascarado.
CREATE OR REPLACE FUNCTION public.add_pix_key(p_type public.pix_key_type, p_value text)
RETURNS public.my_pix_keys LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_value text := btrim(coalesce(p_value, ''));
  v_digits text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
  v_masked text;
  v_row public.my_pix_keys;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  CASE p_type
    WHEN 'cpf' THEN
      IF length(v_digits) <> 11 THEN
        RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_value := v_digits;
      v_masked := '*********-' || right(v_digits, 2);
    WHEN 'cnpj' THEN
      IF length(v_digits) <> 14 THEN
        RAISE EXCEPTION 'CNPJ inválido.' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_value := v_digits;
      v_masked := '************-' || right(v_digits, 2);
    WHEN 'phone' THEN
      IF length(v_digits) NOT BETWEEN 10 AND 13 THEN
        RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_value := v_digits;
      v_masked := '(**) *****-' || right(v_digits, 4);
    WHEN 'email' THEN
      IF v_value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_masked := left(v_value, 1) || '***' || substr(v_value, strpos(v_value, '@'));
    WHEN 'random' THEN
      IF length(v_value) NOT BETWEEN 8 AND 100 THEN
        RAISE EXCEPTION 'Chave aleatória inválida.' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_masked := CASE WHEN length(v_value) > 8 THEN left(v_value, 8) || '…' ELSE v_value END;
  END CASE;

  INSERT INTO pix_keys (user_id, type, value, masked_value)
  VALUES (auth.uid(), p_type, v_value, v_masked)
  RETURNING pix_keys.id, pix_keys.type, pix_keys.masked_value, pix_keys.created_at INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_pix_key(public.pix_key_type, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_pix_key(public.pix_key_type, text) TO authenticated, service_role;

-- ── Limpeza periódica (só se pg_cron estiver instalado) ─────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'release-unpaid-appointments',
      '*/10 * * * *',
      $cron$SELECT public.release_unpaid_appointments(interval '30 minutes')$cron$
    );
  END IF;
END
$do$;
