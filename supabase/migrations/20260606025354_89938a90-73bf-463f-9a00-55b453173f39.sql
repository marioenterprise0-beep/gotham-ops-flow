
-- =========================================
-- Enums
-- =========================================
DO $$ BEGIN
  CREATE TYPE public.punch_status AS ENUM ('open','closed','edited','voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.correction_type AS ENUM ('missed_in','missed_out','wrong_time','extra_time','left_early','stayed_late','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.request_status AS ENUM ('pending','approved','declined','info_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================
-- time_punches
-- =========================================
CREATE TABLE IF NOT EXISTS public.time_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  trailer_id uuid,
  schedule_shift_id uuid,
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  clock_out_at timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  status public.punch_status NOT NULL DEFAULT 'open',
  device_info jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_by uuid,
  edited_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.time_punches TO authenticated;
GRANT ALL ON public.time_punches TO service_role;
ALTER TABLE public.time_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "punches read scoped" ON public.time_punches
FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR public.is_manager(auth.uid())
);

CREATE POLICY "punches insert self" ON public.time_punches
FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "punches update self open" ON public.time_punches
FOR UPDATE TO authenticated
USING (
  (employee_id = auth.uid() AND status = 'open')
  OR public.has_role(auth.uid(), 'owner')
)
WITH CHECK (
  (employee_id = auth.uid() AND status IN ('open','closed'))
  OR public.has_role(auth.uid(), 'owner')
);

CREATE TRIGGER time_punches_touch
BEFORE UPDATE ON public.time_punches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS time_punches_emp_idx ON public.time_punches(employee_id, clock_in_at DESC);
CREATE INDEX IF NOT EXISTS time_punches_trailer_idx ON public.time_punches(trailer_id, clock_in_at DESC);

-- =========================================
-- time_corrections
-- =========================================
CREATE TABLE IF NOT EXISTS public.time_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  trailer_id uuid,
  punch_id uuid,
  schedule_shift_id uuid,
  type public.correction_type NOT NULL,
  for_date date NOT NULL,
  requested_in timestamptz,
  requested_out timestamptz,
  reason text NOT NULL,
  status public.request_status NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.time_corrections TO authenticated;
GRANT ALL ON public.time_corrections TO service_role;
ALTER TABLE public.time_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corrections read scoped" ON public.time_corrections
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR public.is_manager(auth.uid()));

CREATE POLICY "corrections insert self" ON public.time_corrections
FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "corrections update owner" ON public.time_corrections
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR (employee_id = auth.uid() AND status = 'pending'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR (employee_id = auth.uid() AND status = 'pending'));

CREATE TRIGGER time_corrections_touch
BEFORE UPDATE ON public.time_corrections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- time_off_requests
-- =========================================
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  trailer_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  full_day boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  reason text NOT NULL,
  notes text,
  status public.request_status NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.time_off_requests TO authenticated;
GRANT ALL ON public.time_off_requests TO service_role;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeoff read scoped" ON public.time_off_requests
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR public.is_manager(auth.uid()));

CREATE POLICY "timeoff insert self" ON public.time_off_requests
FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "timeoff update owner" ON public.time_off_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR (employee_id = auth.uid() AND status = 'pending'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR (employee_id = auth.uid() AND status = 'pending'));

CREATE TRIGGER time_off_touch
BEFORE UPDATE ON public.time_off_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- shift_notes
-- =========================================
CREATE TABLE IF NOT EXISTS public.shift_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  trailer_id uuid,
  schedule_shift_id uuid,
  punch_id uuid,
  for_date date,
  note text NOT NULL,
  visibility text NOT NULL DEFAULT 'managers',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.shift_notes TO authenticated;
GRANT ALL ON public.shift_notes TO service_role;
ALTER TABLE public.shift_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_notes read scoped" ON public.shift_notes
FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR author_id = auth.uid() OR public.is_manager(auth.uid()));

CREATE POLICY "shift_notes insert" ON public.shift_notes
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());

-- =========================================
-- time_audit (immutable)
-- =========================================
CREATE TABLE IF NOT EXISTS public.time_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.time_audit TO authenticated;
GRANT ALL ON public.time_audit TO service_role;
ALTER TABLE public.time_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_audit read mgr" ON public.time_audit
FOR SELECT TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "time_audit insert auth" ON public.time_audit
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- =========================================
-- Audit trigger for time_punches edits
-- =========================================
CREATE OR REPLACE FUNCTION public.audit_punch_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.time_audit(actor_id, entity, entity_id, action, old_value, new_value)
    VALUES (
      auth.uid(),
      'time_punch',
      NEW.id,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS time_punches_audit ON public.time_punches;
CREATE TRIGGER time_punches_audit
AFTER UPDATE ON public.time_punches
FOR EACH ROW EXECUTE FUNCTION public.audit_punch_change();

-- =========================================
-- Helper: payroll week (Sat -> Fri)
-- =========================================
CREATE OR REPLACE FUNCTION public.payroll_week_start(_d date)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  -- Saturday = 6 in extract(dow). We want week starting Saturday.
  SELECT _d - ((EXTRACT(DOW FROM _d)::int + 1) % 7);
$$;
