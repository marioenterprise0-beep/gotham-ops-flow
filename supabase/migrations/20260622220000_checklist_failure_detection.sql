-- checklist_failure had an email mapping/template wired up but nothing
-- ever created that alert. "The checklist" for a shift phase is really
-- just the set of tasks(shift_id, phase) seeded from task_templates —
-- checklist_sessions is a metadata wrapper around that (who ran it,
-- start/end time). Fires the moment a session is actually closed out
-- (end_at set for the first time, not on every metadata edit) if any
-- of that phase's tasks are still incomplete.
CREATE OR REPLACE FUNCTION public.emit_checklist_failure_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_incomplete_count int;
  v_incomplete_titles text;
  v_trailer_name text;
BEGIN
  IF NEW.end_at IS NOT NULL AND OLD.end_at IS NULL THEN
    SELECT count(*), string_agg(title, ', ' ORDER BY created_at)
      INTO v_incomplete_count, v_incomplete_titles
      FROM public.tasks
      WHERE shift_id = NEW.shift_id AND phase = NEW.phase
        AND status NOT IN ('done', 'signed_off');

    IF v_incomplete_count > 0 THEN
      IF public._has_open_alert('checklist_failure', NEW.id) THEN RETURN NEW; END IF;
      SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
      INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
        created_by, assigned_role, priority, status, payload)
      VALUES ('checklist_failure',
        initcap(NEW.phase::text) || ' checklist incomplete — ' || COALESCE(v_trailer_name, 'Trailer'),
        v_incomplete_count || ' item' || (CASE WHEN v_incomplete_count = 1 THEN '' ELSE 's' END) ||
          ' not completed: ' || v_incomplete_titles,
        'operations', NEW.id, NEW.trailer_id, NEW.created_by, 'manager', 'high', 'pending',
        jsonb_build_object('session_id', NEW.id, 'phase', NEW.phase,
          'incomplete_count', v_incomplete_count, 'incomplete_titles', v_incomplete_titles));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_checklist_session_failure ON public.checklist_sessions;
CREATE TRIGGER trg_checklist_session_failure
AFTER UPDATE OF end_at ON public.checklist_sessions
FOR EACH ROW EXECUTE FUNCTION public.emit_checklist_failure_alert();
