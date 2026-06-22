CREATE OR REPLACE FUNCTION public.sweep_missed_clock_out()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.time_punches p
  SET status = 'auto_closed', clock_out_at = (ss.shift_date + ss.end_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York')
  FROM public.schedule_shifts ss
  JOIN public.trailers t ON t.id = ss.trailer_id
  WHERE p.status = 'open'
    AND p.schedule_shift_id = ss.id
    AND now() > (ss.shift_date + ss.end_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York') + interval '2 hours';

  UPDATE public.time_punches p
  SET status = 'auto_closed', clock_out_at = p.clock_in_at + interval '12 hours'
  WHERE p.status = 'open'
    AND p.schedule_shift_id IS NULL
    AND now() > p.clock_in_at + interval '14 hours';
END $$;

CREATE OR REPLACE FUNCTION public.sweep_missed_clock_in()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift record;
  v_start timestamptz;
  v_emp_name text;
  v_trailer_name text;
BEGIN
  FOR v_shift IN
    SELECT ss.id, ss.employee_id, ss.trailer_id, ss.shift_date, ss.start_time, t.timezone
    FROM public.schedule_shifts ss
    JOIN public.schedules s ON s.id = ss.schedule_id
    JOIN public.trailers t ON t.id = ss.trailer_id
    WHERE s.status = 'published'
      AND ss.employee_id IS NOT NULL
      AND now() > (ss.shift_date + ss.start_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York') + interval '20 minutes'
      AND now() < (ss.shift_date + ss.start_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York') + interval '14 hours'
      AND NOT EXISTS (SELECT 1 FROM public.time_punches p WHERE p.schedule_shift_id = ss.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.time_off_requests tor
        WHERE tor.employee_id = ss.employee_id AND tor.status = 'approved'
          AND ss.shift_date BETWEEN tor.start_date AND tor.end_date
      )
      AND NOT public._has_open_alert('missed_clock_in', ss.id)
  LOOP
    v_start := (v_shift.shift_date + v_shift.start_time) AT TIME ZONE COALESCE(v_shift.timezone, 'America/New_York');
    SELECT display_name INTO v_emp_name FROM public.profiles WHERE id = v_shift.employee_id;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = v_shift.trailer_id;
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload)
    VALUES ('missed_clock_in',
      'Missed clock-in — ' || COALESCE(v_emp_name, 'Employee'),
      COALESCE(v_trailer_name, 'Trailer') || ' · scheduled ' ||
        to_char(v_start AT TIME ZONE COALESCE(v_shift.timezone, 'America/New_York'), 'HH12:MI AM') || ', never clocked in',
      'scheduling', v_shift.id, v_shift.trailer_id, v_shift.employee_id, 'manager', 'high', 'pending',
      jsonb_build_object('shift_id', v_shift.id, 'employee_id', v_shift.employee_id));
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.run_clock_sweep()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sweep_missed_clock_out();
  PERFORM public.sweep_missed_clock_in();
END $$;

GRANT EXECUTE ON FUNCTION public.sweep_missed_clock_out() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_missed_clock_in()  TO service_role;
GRANT EXECUTE ON FUNCTION public.run_clock_sweep()         TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clock-sweep') THEN
    PERFORM cron.unschedule('clock-sweep');
  END IF;
END $$;
SELECT cron.schedule('clock-sweep', '*/15 * * * *', $$ SELECT public.run_clock_sweep(); $$);