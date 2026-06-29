-- Lock down rollover RPCs to service_role only.
-- Do NOT re-grant EXECUTE on these to authenticated in future resweep migrations.
REVOKE EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) TO service_role;

COMMENT ON FUNCTION public.run_daily_rollover(uuid, timestamptz) IS
  'SECURITY DEFINER. service_role ONLY — never re-grant to authenticated/anon (privilege escalation: closes shifts, marks tasks missed, archives alerts).';
COMMENT ON FUNCTION public.dispatch_daily_rollover(timestamptz) IS
  'SECURITY DEFINER. service_role ONLY — never re-grant to authenticated/anon (privilege escalation: triggers rollover for all trailers).';