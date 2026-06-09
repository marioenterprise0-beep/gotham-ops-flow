
-- 1) task_templates: per trailer × role × phase
CREATE TABLE public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_id uuid REFERENCES public.trailers(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  phase shift_phase NOT NULL,
  title text NOT NULL,
  description text,
  requires_signoff boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_templates_read_authenticated"
  ON public.task_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "task_templates_manager_write"
  ON public.task_templates FOR ALL TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

GRANT INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;

CREATE TRIGGER task_templates_touch_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX task_templates_lookup_idx
  ON public.task_templates (trailer_id, role, phase, active);

-- 2) tasks.template_id so we can dedupe per (user, shift, template)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.task_templates(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_template_user_shift_uniq
  ON public.tasks (template_id, assignee_user_id, shift_id)
  WHERE template_id IS NOT NULL AND assignee_user_id IS NOT NULL;
