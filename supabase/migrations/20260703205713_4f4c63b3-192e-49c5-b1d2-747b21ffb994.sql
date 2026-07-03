
-- Loosen geofence tolerance at the DB layer to match the server function.
CREATE OR REPLACE FUNCTION public.enforce_clock_in_geofence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- GPS inside a metal trailer routinely reports 30–80 m accuracy; use the
  -- larger of the phone's reported accuracy and a 50 m floor as edge tolerance
  -- so a good reading at the trailer isn't rejected.
  v_tol := GREATEST(v_acc, 50);

  v_dlat := radians(v_lat - v_trailer.geofence_lat);
  v_dlng := radians(v_lng - v_trailer.geofence_lng);
  v_a := sin(v_dlat/2)^2 + cos(radians(v_trailer.geofence_lat)) * cos(radians(v_lat)) * sin(v_dlng/2)^2;
  v_dist := 6371000 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));

  IF v_dist - v_tol > v_radius THEN
    RAISE EXCEPTION 'You are too far from % (% m away, must be within % m). Clock in once you arrive.',
      COALESCE(v_trailer.name,'the trailer'), round(v_dist)::int, v_radius;
  END IF;

  RETURN NEW;
END $function$;

-- Auto-close guard: never close a punch that was just opened. Requires
-- the punch to be open for at least 2 hours past BOTH the shift end and the
-- clock-in time, so a fresh clock-in that happens to link to a stale shift
-- can't be immediately closed.
CREATE OR REPLACE FUNCTION public.sweep_missed_clock_out()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.time_punches p
  SET status = 'auto_closed',
      clock_out_at = GREATEST(
        (ss.shift_date + ss.end_time + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York'),
        p.clock_in_at + interval '1 minute'
      )
  FROM public.schedule_shifts ss
  JOIN public.trailers t ON t.id = ss.trailer_id
  WHERE p.status = 'open'
    AND p.schedule_shift_id = ss.id
    AND now() > ((ss.shift_date + ss.end_time + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York')) + interval '2 hours'
    AND now() > p.clock_in_at + interval '2 hours';

  UPDATE public.time_punches p
  SET status = 'auto_closed', clock_out_at = p.clock_in_at + interval '12 hours'
  WHERE p.status = 'open'
    AND p.schedule_shift_id IS NULL
    AND now() > p.clock_in_at + interval '14 hours';
END $function$;
