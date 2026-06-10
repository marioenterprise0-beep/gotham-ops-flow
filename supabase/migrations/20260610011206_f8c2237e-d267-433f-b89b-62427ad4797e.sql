REVOKE EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) TO service_role;