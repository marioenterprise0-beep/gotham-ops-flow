-- 1. Trailer timezone (default Eastern; adjust per-trailer later)
ALTER TABLE public.trailers
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York';

-- 2. Enum value additions (each IF NOT EXISTS so re-runs are safe)
ALTER TYPE public.task_status   ADD VALUE IF NOT EXISTS 'missed';
ALTER TYPE public.alert_status  ADD VALUE IF NOT EXISTS 'archived';
ALTER TYPE public.punch_status  ADD VALUE IF NOT EXISTS 'auto_closed';

-- 3. Automation settings (single global row)
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global' UNIQUE,
  rollover_enabled boolean NOT NULL DEFAULT true,
  rollover_hour smallint NOT NULL DEFAULT 3 CHECK (rollover_hour BETWEEN 0 AND 23),
  auto_clock_out_enabled boolean NOT NULL DEFAULT true,
  manager_self_approval boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.automation_settings TO authenticated;
GRANT ALL    ON public.automation_settings TO service_role;

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_settings read all"     ON public.automation_settings;
DROP POLICY IF EXISTS "automation_settings owner update" ON public.automation_settings;
DROP POLICY IF EXISTS "automation_settings owner insert" ON public.automation_settings;

CREATE POLICY "automation_settings read all"
  ON public.automation_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_settings owner update"
  ON public.automation_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "automation_settings owner insert"
  ON public.automation_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER automation_settings_updated
  BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.automation_settings (scope) VALUES ('global') ON CONFLICT (scope) DO NOTHING;

-- 4. Rollover audit table
CREATE TABLE IF NOT EXISTS public.rollover_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_id uuid,
  ran_at timestamptz NOT NULL DEFAULT now(),
  as_of timestamptz NOT NULL,
  shifts_closed int NOT NULL DEFAULT 0,
  punches_auto_closed int NOT NULL DEFAULT 0,
  tasks_missed int NOT NULL DEFAULT 0,
  alerts_archived int NOT NULL DEFAULT 0,
  notes text
);

CREATE INDEX IF NOT EXISTS rollover_runs_trailer_ran_idx
  ON public.rollover_runs (trailer_id, ran_at DESC);

GRANT SELECT ON public.rollover_runs TO authenticated;
GRANT ALL    ON public.rollover_runs TO service_role;

ALTER TABLE public.rollover_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rollover_runs read managers" ON public.rollover_runs;
CREATE POLICY "rollover_runs read managers"
  ON public.rollover_runs FOR SELECT TO authenticated
  USING (is_manager(auth.uid()));