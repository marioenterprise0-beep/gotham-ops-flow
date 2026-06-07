
-- Revoke from PUBLIC and anon, then grant to the roles that actually need EXECUTE.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Grant EXECUTE back to authenticated for helpers used by RLS policies / RPC.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_trailer()          TO authenticated;
GRANT EXECUTE ON FUNCTION public._has_open_alert(alert_type, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) TO authenticated;

-- Queue helpers: service_role only (called from server functions).
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)       TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)       TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
