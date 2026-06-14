-- Restrict trailer geofence coordinates to managers only.
-- Use column-level privileges so non-managers can still read trailer name/timezone
-- for UI labels, but cannot read geofence_lat/geofence_lng/geofence_radius_m.
-- Managers continue to access coordinates via the SECURITY DEFINER RPCs
-- list_trailer_geofences() and get_trailer_geofence().

REVOKE SELECT ON public.trailers FROM authenticated;
REVOKE SELECT ON public.trailers FROM anon;

GRANT SELECT (
  id, name, location, active, created_at, timezone,
  archived_at, archived_by, archive_reason
) ON public.trailers TO authenticated;