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

CREATE TYPE public.maintenance_status AS ENUM ('open', 'in_progress', 'resolved');

CREATE TABLE public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_id uuid REFERENCES public.trailers(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  priority public.alert_priority NOT NULL DEFAULT 'normal',
  photo_url text,
  status public.maintenance_status NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolution_note text,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id),
  archive_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX maintenance_requests_trailer_idx ON public.maintenance_requests(trailer_id);
CREATE INDEX maintenance_requests_status_idx ON public.maintenance_requests(status);

CREATE TRIGGER maintenance_requests_updated BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.maintenance_requests TO authenticated;
GRANT ALL ON public.maintenance_requests TO service_role;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance read scoped" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR is_manager(auth.uid())
    OR trailer_id = current_user_trailer()
  );

CREATE POLICY "maintenance insert self" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "maintenance update manager" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()))
  WITH CHECK (is_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.emit_maintenance_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reporter_name text;
  v_trailer_name text;
BEGIN
  SELECT display_name INTO v_reporter_name FROM public.profiles WHERE id = NEW.reported_by;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('maintenance',
    NEW.title,
    COALESCE(v_trailer_name, 'Trailer') || ' · reported by ' || COALESCE(v_reporter_name, 'Crew'),
    'maintenance', NEW.id, NEW.trailer_id, NEW.reported_by, 'manager', NEW.priority, 'pending',
    jsonb_build_object('request_id', NEW.id, 'description', NEW.description));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_maintenance_request_alert
AFTER INSERT ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.emit_maintenance_alert();