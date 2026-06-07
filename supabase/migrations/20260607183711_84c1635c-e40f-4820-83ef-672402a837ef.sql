CREATE OR REPLACE FUNCTION public._has_open_alert(_type alert_type, _source_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.alerts
    WHERE type = _type AND source_id = _source_id
      AND status IN ('open','pending'))
$$;

-- 1. Inventory threshold alerts
CREATE OR REPLACE FUNCTION public.emit_inventory_threshold_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trailer_name text; v_was_above boolean; v_is_critical boolean;
  v_is_low boolean; v_atype alert_type; v_prio alert_priority; v_title text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_qty = OLD.current_qty THEN RETURN NEW; END IF;
  v_was_above := (TG_OP = 'INSERT') OR (OLD.current_qty > OLD.low_threshold);
  v_is_critical := NEW.minimum_qty > 0 AND NEW.current_qty <= NEW.minimum_qty;
  v_is_low := NEW.current_qty <= NEW.low_threshold AND NOT v_is_critical;
  IF NOT v_is_critical AND NOT v_is_low THEN RETURN NEW; END IF;
  IF NOT v_was_above THEN RETURN NEW; END IF;
  IF v_is_critical THEN
    v_atype := 'critical_stock'; v_prio := 'critical';
    v_title := 'Critical stock — ' || NEW.name;
  ELSE
    v_atype := 'low_stock'; v_prio := 'high';
    v_title := 'Low stock — ' || NEW.name;
  END IF;
  IF public._has_open_alert(v_atype, NEW.id) THEN RETURN NEW; END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES (v_atype, v_title,
    'On hand: ' || NEW.current_qty || ' ' || NEW.unit || ' · Threshold: ' || NEW.low_threshold,
    'inventory', NEW.id, NEW.trailer_id, NULL, 'manager', v_prio, 'pending',
    jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
      'name', NEW.name, 'on_hand', NEW.current_qty, 'unit', NEW.unit,
      'threshold', NEW.low_threshold, 'minimum', NEW.minimum_qty))));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_inventory_threshold_alert ON public.inventory_items;
CREATE TRIGGER trg_inventory_threshold_alert
AFTER INSERT OR UPDATE OF current_qty ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_threshold_alert();

-- 2. Missed clock-out
CREATE OR REPLACE FUNCTION public.emit_missed_clock_out_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp_name text; v_trailer_name text;
BEGIN
  IF NEW.status = 'auto_closed' AND (OLD.status IS DISTINCT FROM 'auto_closed') THEN
    IF public._has_open_alert('missed_clock_out', NEW.id) THEN RETURN NEW; END IF;
    SELECT display_name INTO v_emp_name FROM public.profiles WHERE id = NEW.employee_id;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload)
    VALUES ('missed_clock_out',
      'Missed clock-out — ' || COALESCE(v_emp_name,'Employee'),
      COALESCE(v_trailer_name,'Trailer') || ' · auto-closed at ' || to_char(NEW.clock_out_at,'HH24:MI'),
      'time_clock', NEW.id, NEW.trailer_id, NEW.employee_id, 'manager', 'high', 'pending',
      jsonb_build_object('punch_id', NEW.id, 'employee_id', NEW.employee_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_time_punch_missed_clock_out ON public.time_punches;
CREATE TRIGGER trg_time_punch_missed_clock_out
AFTER UPDATE OF status ON public.time_punches
FOR EACH ROW EXECUTE FUNCTION public.emit_missed_clock_out_alert();

-- 3. Hospitality incidents (high/critical)
CREATE OR REPLACE FUNCTION public.emit_hospitality_incident_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trailer_name text;
BEGIN
  IF NEW.severity NOT IN ('high','critical') THEN RETURN NEW; END IF;
  IF public._has_open_alert('manager_note', NEW.id) THEN RETURN NEW; END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('manager_note',
    'Guest incident (' || NEW.severity || ') — ' || COALESCE(v_trailer_name,'Trailer'),
    COALESCE(NEW.notes, NEW.type),
    'hospitality', NEW.id, NEW.trailer_id, NEW.logged_by, 'owner',
    CASE WHEN NEW.severity = 'critical' THEN 'critical'::alert_priority ELSE 'high'::alert_priority END,
    'pending',
    jsonb_build_object('severity', NEW.severity, 'type', NEW.type, 'recovery', NEW.recovery_action));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hospitality_incident_alert ON public.hospitality_incidents;
CREATE TRIGGER trg_hospitality_incident_alert
AFTER INSERT ON public.hospitality_incidents
FOR EACH ROW EXECUTE FUNCTION public.emit_hospitality_incident_alert();

-- 4. Large cash drops
CREATE OR REPLACE FUNCTION public.emit_large_cash_drop_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trailer_name text;
BEGIN
  IF NEW.amount < 500 THEN RETURN NEW; END IF;
  IF public._has_open_alert('manager_note', NEW.id) THEN RETURN NEW; END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('manager_note',
    'Large cash drop $' || NEW.amount::text || ' — ' || COALESCE(v_trailer_name,'Trailer'),
    'Drop code ' || NEW.drop_code || COALESCE(' · ' || NEW.reason, ''),
    'cash', NEW.id, NEW.trailer_id, NEW.submitted_by, 'owner', 'high', 'pending',
    jsonb_build_object('amount', NEW.amount, 'drop_code', NEW.drop_code));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_large_cash_drop_alert ON public.cash_drops;
CREATE TRIGGER trg_large_cash_drop_alert
AFTER INSERT ON public.cash_drops
FOR EACH ROW EXECUTE FUNCTION public.emit_large_cash_drop_alert();

-- 5. Profile milestones (SOP accepted / Training completed)
CREATE OR REPLACE FUNCTION public.emit_profile_milestone_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trailer_name text; v_kind text; v_title text;
BEGIN
  IF NEW.sop_accepted_at IS NOT NULL AND OLD.sop_accepted_at IS NULL THEN
    v_kind := 'sop_accepted';
    v_title := 'SOP accepted — ' || COALESCE(NEW.display_name,'Crew');
  ELSIF NEW.training_completed_at IS NOT NULL AND OLD.training_completed_at IS NULL THEN
    v_kind := 'training_completed';
    v_title := 'Training completed — ' || COALESCE(NEW.display_name,'Crew');
  ELSE
    RETURN NEW;
  END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('manager_note', v_title,
    COALESCE(v_trailer_name,'Trailer') || ' · ' || v_kind,
    'training', NEW.id, NEW.trailer_id, NEW.id, 'manager', 'normal', 'pending',
    jsonb_build_object('kind', v_kind, 'user_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profile_milestone_alert ON public.profiles;
CREATE TRIGGER trg_profile_milestone_alert
AFTER UPDATE OF sop_accepted_at, training_completed_at ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.emit_profile_milestone_alert();

-- 6. Ensure notify_alert_email fires for every new alert
DROP TRIGGER IF EXISTS trg_notify_alert_email ON public.alerts;
CREATE TRIGGER trg_notify_alert_email
AFTER INSERT ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.notify_alert_email();