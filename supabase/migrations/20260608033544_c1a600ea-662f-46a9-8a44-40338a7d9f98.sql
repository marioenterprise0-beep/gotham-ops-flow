
CREATE OR REPLACE FUNCTION public.enforce_clock_in_geofence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trailer RECORD;
  v_lat double precision;
  v_lng double precision;
  v_acc double precision;
  v_dist double precision;
  v_tol double precision;
  v_radius int;
  v_dlat double precision;
  v_dlng double precision;
  v_a double precision;
BEGIN
  IF NEW.trailer_id IS NULL THEN RETURN NEW; END IF;

  SELECT geofence_lat, geofence_lng, geofence_radius_m, name
    INTO v_trailer
    FROM public.trailers WHERE id = NEW.trailer_id;

  IF v_trailer.geofence_lat IS NULL OR v_trailer.geofence_lng IS NULL THEN
    RETURN NEW;
  END IF;

  v_lat := NULLIF(NEW.device_info #>> '{geo,lat}', '')::double precision;
  v_lng := NULLIF(NEW.device_info #>> '{geo,lng}', '')::double precision;
  v_acc := COALESCE(NULLIF(NEW.device_info #>> '{geo,accuracy}', '')::double precision, 0);

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Location required to clock in at %. Enable location access and try again.', COALESCE(v_trailer.name,'this trailer');
  END IF;

  v_radius := COALESCE(v_trailer.geofence_radius_m, 25);
  v_tol := LEAST(50, v_acc);

  -- Haversine
  v_dlat := radians(v_lat - v_trailer.geofence_lat);
  v_dlng := radians(v_lng - v_trailer.geofence_lng);
  v_a := sin(v_dlat/2)^2 + cos(radians(v_trailer.geofence_lat)) * cos(radians(v_lat)) * sin(v_dlng/2)^2;
  v_dist := 6371000 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));

  IF v_dist - v_tol > v_radius THEN
    RAISE EXCEPTION 'You are too far from % (% m away, must be within % m). Clock in once you arrive.',
      COALESCE(v_trailer.name,'the trailer'), round(v_dist)::int, v_radius;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_clock_in_geofence_trg ON public.time_punches;
CREATE TRIGGER enforce_clock_in_geofence_trg
  BEFORE INSERT ON public.time_punches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_clock_in_geofence();
