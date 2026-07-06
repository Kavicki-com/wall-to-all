-- Security polish — applied 2026-07-06 to the live project (yykqzdiktqlzmvnnokfj).
-- Pins search_path on the remaining functions that lacked it (mitigates
-- search_path hijacking on SECURITY DEFINER functions). Clears the
-- `function_search_path_mutable` advisories.

ALTER FUNCTION public.check_rate_limit(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.create_referral_code_on_signup() SET search_path = public;
ALTER FUNCTION public.get_waitlist_count(bigint, date, time without time zone) SET search_path = public;
ALTER FUNCTION public.join_waitlist(bigint, bigint, date, time without time zone, time without time zone) SET search_path = public;
ALTER FUNCTION public.generate_referral_code() SET search_path = public;
ALTER FUNCTION public.update_push_token_updated_at() SET search_path = public;
ALTER FUNCTION public.update_waitlist_updated_at() SET search_path = public;
