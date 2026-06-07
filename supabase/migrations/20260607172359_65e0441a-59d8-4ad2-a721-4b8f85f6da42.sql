CREATE TABLE public.checklist_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  phase shift_phase NOT NULL,
  trailer_id uuid,
  employee_name text,
  manager_name text,
  manager_initials text,
  start_at timestamptz,
  end_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, phase)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_sessions TO authenticated;
GRANT ALL ON public.checklist_sessions TO service_role;

ALTER TABLE public.checklist_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_sessions read scoped" ON public.checklist_sessions
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR trailer_id IS NULL);

CREATE POLICY "checklist_sessions insert" ON public.checklist_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "checklist_sessions update scoped" ON public.checklist_sessions
  FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()) OR created_by = auth.uid() OR trailer_id = current_user_trailer())
  WITH CHECK (is_manager(auth.uid()) OR created_by = auth.uid() OR trailer_id = current_user_trailer());

CREATE TRIGGER checklist_sessions_updated BEFORE UPDATE ON public.checklist_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();