-- Handbook acknowledgment: per-user, versioned the same way SOP acks are —
-- a user's ack is "current" only if handbook_version >= max(handbook_sections.version).
-- profiles.handbook_acknowledged_at mirrors the existing sop_accepted_at /
-- training_completed_at milestone columns and plugs into the same alert trigger.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handbook_acknowledged_at timestamptz;

CREATE TABLE public.handbook_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  handbook_version integer NOT NULL,
  full_name_typed text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, handbook_version)
);
CREATE INDEX handbook_acks_user_idx ON public.handbook_acknowledgements(user_id);

GRANT SELECT, INSERT ON public.handbook_acknowledgements TO authenticated;
GRANT ALL ON public.handbook_acknowledgements TO service_role;
ALTER TABLE public.handbook_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handbook_acks insert self" ON public.handbook_acknowledgements
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "handbook_acks read self or owner" ON public.handbook_acknowledgements
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'));

-- Extend the existing profile-milestone alert trigger (see migration
-- 20260607183711) with a third branch, rather than adding a parallel trigger.
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
  ELSIF NEW.handbook_acknowledged_at IS NOT NULL AND OLD.handbook_acknowledged_at IS NULL THEN
    v_kind := 'handbook_acknowledged';
    v_title := 'Handbook acknowledged — ' || COALESCE(NEW.display_name,'Crew');
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
AFTER UPDATE OF sop_accepted_at, training_completed_at, handbook_acknowledged_at ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.emit_profile_milestone_alert();
