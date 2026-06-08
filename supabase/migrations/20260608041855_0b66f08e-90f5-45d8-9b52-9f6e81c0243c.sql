CREATE OR REPLACE VIEW public.trailers_with_geofence AS
  SELECT id,
         name,
         location,
         active,
         created_at,
         timezone,
         geofence_lat,
         geofence_lng,
         geofence_radius_m
    FROM public.trailers
   WHERE public.is_manager(auth.uid());

GRANT SELECT ON public.trailers_with_geofence TO authenticated;
GRANT SELECT ON public.trailers_with_geofence TO service_role;