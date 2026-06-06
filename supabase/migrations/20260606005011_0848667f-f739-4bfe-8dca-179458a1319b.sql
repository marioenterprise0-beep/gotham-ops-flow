
-- Enums
CREATE TYPE public.schedule_status AS ENUM ('draft','submitted','approved','locked','published');
CREATE TYPE public.shift_segment AS ENUM ('open','mid','close','custom');

-- Schedules
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trailer_id uuid REFERENCES public.trailers(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.schedule_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  locked_by uuid, locked_at timestamptz, lock_reason text,
  published_by uuid, published_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select_auth" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedules_insert_mgr" ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "schedules_update_mgr" ON public.schedules FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "schedules_delete_owner" ON public.schedules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner'));

CREATE TRIGGER schedules_touch BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Shift slots
CREATE TABLE public.schedule_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trailer_id uuid REFERENCES public.trailers(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'cashier',
  segment public.shift_segment NOT NULL DEFAULT 'mid',
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_minutes int NOT NULL DEFAULT 30,
  notes text,
  repeat_weekly boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX schedule_shifts_schedule_idx ON public.schedule_shifts(schedule_id);
CREATE INDEX schedule_shifts_employee_idx ON public.schedule_shifts(employee_id, shift_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_shifts TO authenticated;
GRANT ALL ON public.schedule_shifts TO service_role;
ALTER TABLE public.schedule_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_shifts_select_auth" ON public.schedule_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule_shifts_write_mgr" ON public.schedule_shifts FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

CREATE TRIGGER schedule_shifts_touch BEFORE UPDATE ON public.schedule_shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Templates
CREATE TABLE public.shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'cashier',
  segment public.shift_segment NOT NULL DEFAULT 'mid',
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_minutes int NOT NULL DEFAULT 30,
  trailer_id uuid REFERENCES public.trailers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_templates TO authenticated;
GRANT ALL ON public.shift_templates TO service_role;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_templates_select_auth" ON public.shift_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_templates_write_mgr" ON public.shift_templates FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
