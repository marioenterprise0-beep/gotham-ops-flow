CREATE OR REPLACE FUNCTION public.sweep_missed_clock_out()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.time_punches p
  SET status = 'auto_closed',
      clock_out_at = (ss.shift_date + ss.end_time + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
        AT TIME ZONE COALESCE(t.timezone, 'America/New_York')
  FROM public.schedule_shifts ss
  JOIN public.trailers t ON t.id = ss.trailer_id
  WHERE p.status = 'open'
    AND p.schedule_shift_id = ss.id
    AND now() > ((ss.shift_date + ss.end_time + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
      AT TIME ZONE COALESCE(t.timezone, 'America/New_York')) + interval '2 hours';

  UPDATE public.time_punches p
  SET status = 'auto_closed', clock_out_at = p.clock_in_at + interval '12 hours'
  WHERE p.status = 'open'
    AND p.schedule_shift_id IS NULL
    AND now() > p.clock_in_at + interval '14 hours';
END $$;

REVOKE ALL ON FUNCTION public.sweep_missed_clock_out() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_missed_clock_out() TO service_role;