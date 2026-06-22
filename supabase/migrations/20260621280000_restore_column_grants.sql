-- Migration 20260610012255 did a blanket
-- `GRANT SELECT ON public.profiles/trailers TO authenticated`, silently
-- undoing two earlier rounds of deliberate column-level hardening
-- (20260607190507, 20260608040335, 20260608162532, 20260608235612).
-- That blanket grant re-exposed profiles.email, archive_reason,
-- archived_by, and trailers' geofence_lat/geofence_lng/geofence_radius_m
-- (trailer GPS coordinates) to every authenticated user, not just
-- managers/owners. Restoring column-level restriction; the few
-- legitimate manager/owner-gated readers of these columns now go through
-- supabaseAdmin in application code instead (see the same-day code
-- changes alongside this migration).

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, store_id, trailer_id, active,
  last_login_at, sop_accepted_at, training_completed_at,
  handbook_acknowledged_at, archived_at, created_at, updated_at
) ON public.profiles TO authenticated;

REVOKE SELECT ON public.trailers FROM authenticated;
DO $$
DECLARE col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO col_list
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'trailers'
     AND column_name NOT IN ('geofence_lat', 'geofence_lng', 'geofence_radius_m');
  EXECUTE format('GRANT SELECT (%s) ON public.trailers TO authenticated', col_list);
END $$;
