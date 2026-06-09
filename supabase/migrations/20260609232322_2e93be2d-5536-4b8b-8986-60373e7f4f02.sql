
-- Version history for task_templates
CREATE TABLE public.task_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  version int NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  actor_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  before jsonb,
  after jsonb,
  changed_fields text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX task_template_versions_template_idx
  ON public.task_template_versions (template_id, version DESC);

GRANT SELECT ON public.task_template_versions TO authenticated;
GRANT ALL ON public.task_template_versions TO service_role;

ALTER TABLE public.task_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view template history"
  ON public.task_template_versions FOR SELECT
  TO authenticated
  USING (public.is_manager(auth.uid()));

-- Trigger function: snapshot every change with a diff of fields
CREATE OR REPLACE FUNCTION public.log_task_template_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_fields text[] := '{}';
  v_next int;
  v_id uuid;
  v_tracked text[] := ARRAY['trailer_id','role','phase','title','description','requires_signoff','position','active'];
  f text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_before := NULL;
    v_after  := to_jsonb(NEW);
    v_id := NEW.id;
    v_fields := v_tracked;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    v_id := NEW.id;
    FOREACH f IN ARRAY v_tracked LOOP
      IF (v_before -> f) IS DISTINCT FROM (v_after -> f) THEN
        v_fields := array_append(v_fields, f);
      END IF;
    END LOOP;
    IF array_length(v_fields, 1) IS NULL THEN
      RETURN NEW; -- nothing meaningful changed
    END IF;
  ELSE
    v_action := 'delete';
    v_before := to_jsonb(OLD);
    v_after  := NULL;
    v_id := OLD.id;
    v_fields := v_tracked;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next
    FROM public.task_template_versions WHERE template_id = v_id;

  INSERT INTO public.task_template_versions
    (template_id, version, action, actor_id, before, after, changed_fields)
  VALUES (v_id, v_next, v_action, auth.uid(), v_before, v_after, v_fields);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER trg_task_template_versions
AFTER INSERT OR UPDATE OR DELETE ON public.task_templates
FOR EACH ROW EXECUTE FUNCTION public.log_task_template_version();

-- Seed an initial 'create' snapshot for any templates that already exist
INSERT INTO public.task_template_versions (template_id, version, action, actor_id, before, after, changed_fields, changed_at)
SELECT t.id, 1, 'create', t.created_by, NULL, to_jsonb(t),
       ARRAY['trailer_id','role','phase','title','description','requires_signoff','position','active'],
       t.created_at
FROM public.task_templates t
WHERE NOT EXISTS (SELECT 1 FROM public.task_template_versions v WHERE v.template_id = t.id);
