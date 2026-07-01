CREATE OR REPLACE FUNCTION public.resolve_time_alerts_from_punch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id uuid;
  v_shift_date date;
  v_actor uuid;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_actor := COALESCE(NEW.edited_by, NEW.created_by, NEW.employee_id);

  -- Missed clock-out alerts are keyed directly to the punch that was auto-closed.
  IF NEW.clock_out_at IS NOT NULL THEN
    UPDATE public.alerts
       SET status = 'resolved',
           resolved_by = v_actor,
           resolved_at = now(),
           resolution = COALESCE(resolution, 'Punch corrected')
     WHERE type = 'missed_clock_out'
       AND source_id = NEW.id
       AND status IN ('open','pending');
  END IF;

  -- Missed clock-in alerts are keyed to the schedule shift. Resolve the exact
  -- linked shift first, then fall back to the employee's shift on the same
  -- local schedule date so manually-entered punches without a link still clear.
  IF NEW.schedule_shift_id IS NOT NULL THEN
    UPDATE public.alerts
       SET status = 'resolved',
           resolved_by = v_actor,
           resolved_at = now(),
           resolution = COALESCE(resolution, 'Punch corrected')
     WHERE type = 'missed_clock_in'
       AND source_id = NEW.schedule_shift_id
       AND status IN ('open','pending');
  END IF;

  SELECT ss.id, ss.shift_date
    INTO v_shift_id, v_shift_date
    FROM public.schedule_shifts ss
    LEFT JOIN public.trailers t ON t.id = ss.trailer_id
   WHERE ss.archived_at IS NULL
     AND ss.employee_id = NEW.employee_id
     AND (NEW.trailer_id IS NULL OR ss.trailer_id = NEW.trailer_id)
     AND ss.shift_date BETWEEN ((NEW.clock_in_at AT TIME ZONE COALESCE(t.timezone, 'America/New_York'))::date - 1)
                          AND ((NEW.clock_in_at AT TIME ZONE COALESCE(t.timezone, 'America/New_York'))::date + 1)
   ORDER BY abs(extract(epoch FROM ((ss.shift_date + ss.start_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York') - NEW.clock_in_at)))
   LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    IF NEW.schedule_shift_id IS NULL THEN
      NEW.schedule_shift_id := v_shift_id;
    END IF;

    UPDATE public.alerts
       SET status = 'resolved',
           resolved_by = v_actor,
           resolved_at = now(),
           resolution = COALESCE(resolution, 'Punch corrected')
     WHERE type = 'missed_clock_in'
       AND source_id = v_shift_id
       AND status IN ('open','pending');
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_resolve_time_alerts_from_punch ON public.time_punches;
CREATE TRIGGER trg_resolve_time_alerts_from_punch
BEFORE INSERT OR UPDATE OF clock_in_at, clock_out_at, status, schedule_shift_id, archived_at
ON public.time_punches
FOR EACH ROW
EXECUTE FUNCTION public.resolve_time_alerts_from_punch();

GRANT EXECUTE ON FUNCTION public.resolve_time_alerts_from_punch() TO service_role;