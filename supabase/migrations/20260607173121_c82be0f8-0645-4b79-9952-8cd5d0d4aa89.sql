CREATE OR REPLACE FUNCTION public.run_daily_rollover(_trailer_id uuid, _as_of timestamptz DEFAULT now())
RETURNS public.rollover_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Tasks: anything not finished on active shifts for this trailer -> missed
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

  -- Shifts: close active shifts
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

  -- Punches: auto clock out anyone still on the clock (if enabled)
  IF v_settings.auto_clock_out_enabled THEN
    WITH upd AS (
      UPDATE public.time_punches
         SET status = 'auto_closed',
             clock_out_at = _as_of,
             notes = COALESCE(notes,'') ||
                     CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END ||
                     'System Auto Clock Out'
       WHERE status = 'open'
         AND (trailer_id = _trailer_id OR _trailer_id IS NULL)
       RETURNING 1
    )
    SELECT count(*) INTO v_punches FROM upd;
  END IF;

  -- Alerts: archive resolved alerts older than 7d (keep open/active visible)
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

REVOKE ALL ON FUNCTION public.run_daily_rollover(uuid, timestamptz) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) TO service_role;

-- Convenience: run for all eligible trailers when local hour matches rollover_hour
CREATE OR REPLACE FUNCTION public.dispatch_daily_rollover(_now timestamptz DEFAULT now())
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.automation_settings%ROWTYPE;
  v_count int := 0;
  r record;
BEGIN
  SELECT * INTO v_settings FROM public.automation_settings WHERE scope = 'global' LIMIT 1;
  IF v_settings.id IS NULL OR NOT v_settings.rollover_enabled THEN RETURN 0; END IF;

  FOR r IN
    SELECT t.id, t.timezone
      FROM public.trailers t
     WHERE t.active = true
  LOOP
    -- Fire only when local hour == configured hour and we haven't already run today (local)
    IF EXTRACT(HOUR FROM (_now AT TIME ZONE r.timezone))::int = v_settings.rollover_hour
       AND NOT EXISTS (
         SELECT 1 FROM public.rollover_runs rr
         WHERE rr.trailer_id = r.id
           AND (rr.ran_at AT TIME ZONE r.timezone)::date = (_now AT TIME ZONE r.timezone)::date
       )
    THEN
      PERFORM public.run_daily_rollover(r.id, _now);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.dispatch_daily_rollover(timestamptz) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) TO service_role;