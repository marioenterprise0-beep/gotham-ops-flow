
-- Cash drawer close → alert
CREATE OR REPLACE FUNCTION public.emit_cash_drawer_close_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trailer_name text;
  v_priority alert_priority;
  v_title text;
  v_var numeric;
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    v_var := COALESCE(NEW.variance, 0);
    IF abs(v_var) >= 20 THEN
      v_priority := 'critical';
      v_title := 'Cash Variance — ' || COALESCE(v_trailer_name,'Trailer') || ' · ' ||
                 CASE WHEN v_var >= 0 THEN '+' ELSE '' END || v_var::text;
    ELSIF abs(v_var) >= 5 THEN
      v_priority := 'high';
      v_title := 'Cash Variance — ' || COALESCE(v_trailer_name,'Trailer');
    ELSE
      v_priority := 'normal';
      v_title := 'Drawer Closed — ' || COALESCE(v_trailer_name,'Trailer');
    END IF;

    INSERT INTO public.alerts (
      type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload
    ) VALUES (
      'manager_note', v_title,
      'Counted: ' || COALESCE(NEW.counted_amount::text,'—') ||
      ' · Expected: ' || COALESCE(NEW.expected_amount::text,'—'),
      'cash', NEW.id, NEW.trailer_id, NEW.closed_by, 'owner',
      v_priority, 'pending',
      jsonb_build_object('variance', v_var, 'counted', NEW.counted_amount, 'expected', NEW.expected_amount)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_emit_cash_drawer_close_alert ON public.cash_drawer_sessions;
CREATE TRIGGER trg_emit_cash_drawer_close_alert
AFTER UPDATE ON public.cash_drawer_sessions
FOR EACH ROW EXECUTE FUNCTION public.emit_cash_drawer_close_alert();

-- Schedule submitted → alert
CREATE OR REPLACE FUNCTION public.emit_schedule_submitted_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    INSERT INTO public.alerts (
      type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload
    ) VALUES (
      'schedule_approval',
      'Schedule Submitted — ' || COALESCE(v_trailer_name,'Trailer'),
      COALESCE(NEW.name, 'Schedule') || ' · ' || NEW.start_date || ' → ' || NEW.end_date,
      'schedule', NEW.id, NEW.trailer_id, NEW.submitted_by, 'owner',
      'high', 'pending',
      jsonb_build_object('schedule_id', NEW.id, 'start_date', NEW.start_date, 'end_date', NEW.end_date)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_emit_schedule_submitted_alert ON public.schedules;
CREATE TRIGGER trg_emit_schedule_submitted_alert
AFTER UPDATE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.emit_schedule_submitted_alert();
