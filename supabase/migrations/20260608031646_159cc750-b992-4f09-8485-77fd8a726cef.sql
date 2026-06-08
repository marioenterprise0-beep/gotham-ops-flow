ALTER TABLE public.trailers
  ADD COLUMN IF NOT EXISTS geofence_lat double precision,
  ADD COLUMN IF NOT EXISTS geofence_lng double precision,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 25;