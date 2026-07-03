
-- 1) Precise auto-close: only close punches that were actually opened by a real clock-in.
--    Scheduled: close exactly at scheduled end (never inflate past it), only after end+2h grace.
--    Unscheduled: DO NOT auto-close. Leave open so a manager can review and set the true clock-out.
CREATE OR REPLACE FUNCTION public.sweep_missed_clock_out()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Scheduled shifts only: close at the scheduled end time (no padding added to hours)
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
    AND now() > ((ss.shift_date + ss.end_time
          + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York')) + interval '2 hours';

  -- Unscheduled open punches: do NOT auto-close (would inflate hours arbitrarily).
  -- Manager review handles these via the missed-clock-out alert / punch edit.
END $$;

REVOKE ALL ON FUNCTION public.sweep_missed_clock_out() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_missed_clock_out() TO service_role;

-- 2) Daily rollover: stop auto-closing punches. Sweep handles it precisely per-shift.
CREATE OR REPLACE FUNCTION public.run_daily_rollover(_trailer_id uuid, _as_of timestamp with time zone DEFAULT now())
RETURNS rollover_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings public.automation_settings%ROWTYPE;
  v_shifts_closed int := 0;
  v_punches int := 0;
  v_tasks int := 0;
  v_alerts int := 0;
  v_run public.rollover_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM public.automation_settings WHERE scope = 'global' LIMIT 1;
  IF v_settings.id IS NULL OR NOT v_settings.rollover_enabled THEN
    INSERT INTO public.rollover_runs (trailer_id, as_of, notes)
    VALUES (_trailer_id, _as_of, 'skipped: rollover disabled')
    RETURNING * INTO v_run;
    RETURN v_run;
  END IF;

  WITH active AS (
    SELECT id FROM public.shifts
    WHERE status = 'active' AND (trailer_id = _trailer_id OR _trailer_id IS NULL)
  ),
  upd AS (
    UPDATE public.tasks t
       SET status = 'missed'
     WHERE t.shift_id IN (SELECT id FROM active)
       AND t.status NOT IN ('done', 'signed_off', 'missed')
     RETURNING 1
  )
  SELECT count(*) INTO v_tasks FROM upd;

  WITH upd AS (
    UPDATE public.shifts
       SET status = 'closed',
           closed_at = _as_of,
           notes = COALESCE(notes,'') ||
                   CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END ||
                   'Auto-closed by daily rollover at ' || _as_of::text
     WHERE status = 'active' AND (trailer_id = _trailer_id OR _trailer_id IS NULL)
     RETURNING 1
  )
  SELECT count(*) INTO v_shifts_closed FROM upd;

  -- Punches: NEVER auto-close from rollover. sweep_missed_clock_out handles
  -- scheduled shifts precisely (at their real scheduled end). Unscheduled
  -- open punches stay open for manager review — this prevents inflated hours.
  v_punches := 0;

  WITH upd AS (
    UPDATE public.alerts
       SET status = 'archived'
     WHERE status = 'resolved'
       AND resolved_at < _as_of - INTERVAL '7 days'
       AND (trailer_id = _trailer_id OR _trailer_id IS NULL)
     RETURNING 1
  )
  SELECT count(*) INTO v_alerts FROM upd;

  INSERT INTO public.rollover_runs (
    trailer_id, as_of, shifts_closed, punches_auto_closed, tasks_missed, alerts_archived
  ) VALUES (
    _trailer_id, _as_of, v_shifts_closed, v_punches, v_tasks, v_alerts
  )
  RETURNING * INTO v_run;

  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, payload)
  VALUES (
    NULL, 'daily_rollover', 'trailer', _trailer_id,
    jsonb_build_object(
      'as_of', _as_of,
      'shifts_closed', v_shifts_closed,
      'punches_auto_closed', v_punches,
      'tasks_missed', v_tasks,
      'alerts_archived', v_alerts
    )
  );

  RETURN v_run;
END $$;
