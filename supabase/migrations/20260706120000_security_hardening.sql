-- Security hardening — applied 2026-07-06 to the live project (yykqzdiktqlzmvnnokfj)
-- via the Management API. This file versions those changes so the schema is tracked.
--
-- Closes: push phishing (send-push-notification), notification injection
-- (insert_notification), referral fraud (process_referral), rate-limit function
-- exposure (check_rate_limit) and anon object listing on public storage buckets.

-- 1) Authorization helper: may p_caller send a notification/push to p_target?
--    Allowed when it's the same user or they share an appointment (client <-> merchant).
CREATE OR REPLACE FUNCTION public.can_notify(p_caller uuid, p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_caller = p_target OR EXISTS (
    SELECT 1 FROM appointments a
    JOIN business_profiles b ON b.id = a.business_id
    WHERE (a.client_id = p_caller AND b.owner_id = p_target)
       OR (b.owner_id = p_caller AND a.client_id = p_target)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_notify(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_notify(uuid, uuid) TO authenticated, service_role;

-- 2) insert_notification: authorize the caller (self / appointment counterparty / service_role).
CREATE OR REPLACE FUNCTION public.insert_notification(
    p_user_id uuid, p_type text, p_title text, p_message text,
    p_related_appointment_id integer DEFAULT NULL,
    p_related_reschedule_id integer DEFAULT NULL,
    p_related_id integer DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_notification_id BIGINT;
    v_role text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
BEGIN
    IF p_user_id IS NULL OR p_type IS NULL OR p_title IS NULL OR p_message IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Parâmetros obrigatórios não fornecidos');
    END IF;

    IF v_role <> 'service_role'
       AND auth.uid() IS DISTINCT FROM p_user_id
       AND NOT EXISTS (
           SELECT 1 FROM appointments a
           JOIN business_profiles b ON b.id = a.business_id
           WHERE (a.client_id = auth.uid() AND b.owner_id = p_user_id)
              OR (b.owner_id = auth.uid() AND a.client_id = p_user_id)
       )
    THEN
        RETURN json_build_object('success', false, 'error', 'Não autorizado a notificar este usuário');
    END IF;

    INSERT INTO notifications (user_id, type, title, message, related_appointment_id, related_reschedule_id, related_id, read, created_at)
    VALUES (p_user_id, p_type, p_title, p_message, p_related_appointment_id, p_related_reschedule_id, p_related_id, false, NOW())
    RETURNING id INTO v_notification_id;

    RETURN json_build_object('success', true, 'id', v_notification_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.insert_notification(uuid, text, text, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_notification(uuid, text, text, text, integer, integer, integer) TO authenticated, service_role;

-- 3) check_rate_limit: only the server (service_role / edge function) may call it.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- 4) process_referral: a user may only process a referral FOR THEMSELVES (or service_role).
--    Previously it accepted an arbitrary p_referred_id with no auth check (referral fraud
--    + overwrote profiles.referred_by for any user).
CREATE OR REPLACE FUNCTION public.process_referral(p_referred_id uuid, p_referral_code character varying)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral_code_record RECORD;
  v_role text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
BEGIN
  IF v_role <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_referred_id) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_referral_code_record
  FROM referral_codes WHERE code = UPPER(p_referral_code) AND is_active = true;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_referral_code_record.user_id = p_referred_id THEN RETURN false; END IF;

  INSERT INTO referrals (referrer_id, referred_id, referral_code_id, status)
  VALUES (v_referral_code_record.user_id, p_referred_id, v_referral_code_record.id, 'pending')
  ON CONFLICT (referred_id) DO NOTHING;

  UPDATE referral_codes SET uses_count = uses_count + 1, updated_at = NOW()
  WHERE id = v_referral_code_record.id;

  UPDATE profiles SET referred_by = v_referral_code_record.user_id WHERE id = p_referred_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.process_referral(uuid, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_referral(uuid, character varying) TO authenticated, service_role;

-- 5) Trigger functions: they run as triggers, never called directly. Remove direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_referral_code_on_signup() FROM PUBLIC, anon, authenticated;

-- 6) check_profile_integrity: read-only integrity check, no need to expose to anon.
REVOKE EXECUTE ON FUNCTION public.check_profile_integrity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_profile_integrity(uuid) TO authenticated, service_role;

-- 7) Storage: drop anonymous object LISTING on the public asset buckets. Files remain
--    reachable by public URL (buckets are public); only enumeration/listing is removed.
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read business logos" ON storage.objects;
