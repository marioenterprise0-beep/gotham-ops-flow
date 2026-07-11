CREATE OR REPLACE FUNCTION public.sweep_missed_clock_out()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Scheduled shifts only: close at the scheduled end time (no padding added to hours).
  -- Only sweep punches that actually started before the scheduled end — a late
  -- clock-in (started after scheduled end) is treated as unscheduled and left
  -- alone for manager review.
  UPDATE public.time_punches p
  SET status = 'auto_closed',
      clock_out_at = GREATEST(
        (ss.shift_date + ss.end_time
          + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York'),
        p.clock_in_at + interval '1 minute'
      ),
      notes = COALESCE(p.notes,'') ||
              CASE WHEN p.notes IS NULL OR p.notes = '' THEN '' ELSE E'\n' END ||
              'Auto-closed at scheduled end (missed clock-out)'
  FROM public.schedule_shifts ss
  JOIN public.trailers t ON t.id = ss.trailer_id
  WHERE p.status = 'open'
    AND p.archived_at IS NULL
    AND p.schedule_shift_id = ss.id
    AND p.clock_in_at < ((ss.shift_date + ss.end_time
          + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York'))
    AND now() > ((ss.shift_date + ss.end_time
          + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York')) + interval '2 hours';

  -- Unscheduled open punches: do NOT auto-close (would inflate hours arbitrarily).
END $function$;