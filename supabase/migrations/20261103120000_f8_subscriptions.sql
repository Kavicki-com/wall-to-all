-- F8 Task 17: assinatura do lojista no Stripe Billing (só cartão).
-- Design: docs/plans/2026-11-02-f8-pagamentos-stripe-design.md (§ 16, Task 17).
-- Teste: supabase/tests/f8_subscriptions.sql (BEGIN ... ROLLBACK).
--
-- A Stripe é a fonte da verdade: a Edge Function `subscriptions` lê a
-- assinatura direto da API e grava aqui a cópia; o `stripe-webhook` mantém a
-- cópia em dia (renovação, atraso, cancelamento). A tabela existe para o app
-- e o banco saberem quais negócios estão em dia sem chamar a Stripe.
--
-- Mesmas regras da 20261102120000_f8_payments.sql: nomes neutros de PSP,
-- escrita só pelo service role, o app (authenticated) só lê o que é dele.

CREATE TABLE public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              bigint NOT NULL REFERENCES public.business_profiles (id) ON DELETE CASCADE,
  provider                 text NOT NULL DEFAULT 'stripe',
  provider_subscription_id text NOT NULL UNIQUE,
  provider_customer_id     text,
  price_id                 text,
  status                   text NOT NULL
    CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  current_period_end       timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_business_id_idx ON public.subscriptions (business_id);

CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.f8_touch_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- O Supabase concede ALL em tabela nova para anon/authenticated por default
-- privileges: revoga e devolve só a leitura.
REVOKE ALL ON public.subscriptions FROM anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

CREATE POLICY subscriptions_select_owner ON public.subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.business_profiles b
    WHERE b.id = subscriptions.business_id AND b.owner_id = (SELECT auth.uid())
  ));
