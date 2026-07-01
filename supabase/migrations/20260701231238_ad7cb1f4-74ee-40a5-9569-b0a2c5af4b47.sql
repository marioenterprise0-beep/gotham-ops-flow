REVOKE ALL ON FUNCTION public.resolve_time_alerts_from_punch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_time_alerts_from_punch() TO service_role;