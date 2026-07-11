CREATE OR REPLACE FUNCTION public.run_daily_rollover(_trailer_id uuid, _as_of timestamp with time zone DEFAULT now())
 RETURNS rollover_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Mark incomplete tasks on active shifts as missed
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

  -- Auto-close still-active operational shifts
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

  -- Auto-close open time punches at rollover when enabled.
  -- Skips punches attached to a schedule shift whose schedule is 'locked'
  -- (locked schedules are treated as finalized — do not mutate hours).
  IF COALESCE(v_settings.auto_clock_out_enabled, false) THEN
    WITH upd AS (
      UPDATE public.time_punches tp
         SET clock_out_at = _as_of,
             status = 'auto_closed',
             notes = COALESCE(tp.notes,'') ||
                     CASE WHEN tp.notes IS NULL OR tp.notes = '' THEN '' ELSE E'\n' END ||
                     'Auto clock-out by daily rollover at ' || _as_of::text
       WHERE tp.clock_out_at IS NULL
         AND tp.archived_at IS NULL
         AND (tp.trailer_id = _trailer_id OR _trailer_id IS NULL)
         AND NOT EXISTS (
           SELECT 1
             FROM public.schedule_shifts ss
             JOIN public.schedules s ON s.id = ss.schedule_id
            WHERE ss.id = tp.schedule_shift_id
              AND s.status = 'locked'
         )
       RETURNING 1
    )
    SELECT count(*) INTO v_punches FROM upd;
  END IF;

  -- Archive stale resolved alerts (older than 7d)
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
END $function$;