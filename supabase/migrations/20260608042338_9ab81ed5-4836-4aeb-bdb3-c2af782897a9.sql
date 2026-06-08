DROP VIEW IF EXISTS public.trailers_with_geofence;

CREATE OR REPLACE FUNCTION public.list_trailer_geofences()
RETURNS TABLE (
  id uuid,
  name text,
  geofence_lat double precision,
  geofence_lng double precision,
  geofence_radius_m int,
  active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.geofence_lat, t.geofence_lng, t.geofence_radius_m, t.active
  FROM public.trailers t
  WHERE public.is_manager(auth.uid())
  ORDER BY t.name
$$;

REVOKE ALL ON FUNCTION public.list_trailer_geofences() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_trailer_geofences() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_trailer_geofence(_trailer_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  geofence_lat double precision,
  geofence_lng double precision,
  geofence_radius_m int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.geofence_lat, t.geofence_lng, t.geofence_radius_m
  FROM public.trailers t
  WHERE t.id = _trailer_id AND public.is_manager(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.get_trailer_geofence(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_trailer_geofence(uuid) TO authenticated, service_role;