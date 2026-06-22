-- 20260607184645 already did this exact sweep once — revoke EXECUTE on
-- every SECURITY DEFINER function in public from PUBLIC/anon, re-grant
-- only what's actually needed. It only covered functions that existed
-- as of June 7th, so everything created since (including every trigger
-- function added tonight: sweep_missed_clock_out/in, run_clock_sweep,
-- emit_checklist_failure_alert, emit_maintenance_alert,
-- hr_assignment_update_guard, check_hr_assignment_complete, etc.)
-- defaulted back to Postgres's implicit PUBLIC-execute grant — exactly
-- the "Public Can Execute SECURITY DEFINER Function" finding. None of
-- these need a re-grant afterward: they're either trigger functions
-- (invoked implicitly by the trigger mechanism, never a direct call,
-- so EXECUTE privilege is irrelevant to them firing) or called only by
-- pg_cron (which runs as a superuser-tier role that bypasses grants
-- entirely).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-assert the same authenticated/service_role grants the original
-- sweep established, in case any got clobbered by a later
-- CREATE OR REPLACE FUNCTION (which resets grants to the default).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_trailer()          TO authenticated;
GRANT EXECUTE ON FUNCTION public._has_open_alert(alert_type, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_week_start(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trailer_geofence(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_trailer_geofences() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_depths() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)       TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)       TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
