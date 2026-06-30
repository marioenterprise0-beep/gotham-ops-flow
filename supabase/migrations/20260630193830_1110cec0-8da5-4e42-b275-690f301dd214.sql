
REVOKE UPDATE (is_super_admin) ON public.profiles FROM authenticated;
REVOKE UPDATE (is_super_admin) ON public.profiles FROM anon;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, store_id, trailer_id, active, last_login_at,
  sop_accepted_at, training_completed_at, handbook_acknowledged_at,
  archived_at, archived_by, archive_reason, created_at, updated_at,
  weekly_hours, pay_rate
) ON public.profiles TO authenticated;

REVOKE EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamp with time zone) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamp with time zone) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamp with time zone) TO service_role;
