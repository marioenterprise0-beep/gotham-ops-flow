-- maintenance had an email mapping/template wired up but no feature
-- behind it at all. New table + minimal report -> notify -> resolve
-- lifecycle, mirroring hospitality_incidents' shape (trailer_id from the
-- reporter's profile, logged-style fields) but with a real status
-- lifecycle since maintenance issues need tracking until fixed, not
-- just logging.
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

-- Reporters always see their own; everyone at the same trailer sees open
-- issues affecting their location (so coworkers know not to use a broken
-- fryer); managers/owners see everything.
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

-- Progressing/resolving (and archiving) is manager-only — matches the
-- decision step in time_off/time_corrections.
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
