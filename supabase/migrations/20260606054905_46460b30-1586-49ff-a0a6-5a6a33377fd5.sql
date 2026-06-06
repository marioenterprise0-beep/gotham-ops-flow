
-- Extend alert_type enum
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'manager_recap';

-- Recap status enum
DO $$ BEGIN
  CREATE TYPE public.recap_status AS ENUM ('draft','submitted','reviewed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- daily_recaps table
CREATE TABLE IF NOT EXISTS public.daily_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recap_date date NOT NULL DEFAULT CURRENT_DATE,
  shift_id uuid,
  manager_id uuid NOT NULL,
  trailer_id uuid,
  location text,
  crew jsonb NOT NULL DEFAULT '[]'::jsonb,
  shift_score int CHECK (shift_score IS NULL OR (shift_score BETWEEN 1 AND 10)),
  status public.recap_status NOT NULL DEFAULT 'draft',
  -- Operations
  ops_went_well text,
  ops_slowed text,
  ops_attention text,
  -- Inventory
  inv_low_stock text,
  inv_concerns text,
  inv_orders text,
  -- Labor
  labor_attendance text,
  labor_staffing text,
  labor_performance text,
  -- Hospitality
  hosp_feedback text,
  hosp_wins text,
  hosp_complaints text,
  -- Next shift
  next_shift_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  owner_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_recaps_date_idx ON public.daily_recaps (recap_date DESC);
CREATE INDEX IF NOT EXISTS daily_recaps_manager_idx ON public.daily_recaps (manager_id, recap_date DESC);
CREATE INDEX IF NOT EXISTS daily_recaps_trailer_idx ON public.daily_recaps (trailer_id, recap_date DESC);
CREATE INDEX IF NOT EXISTS daily_recaps_status_idx ON public.daily_recaps (status);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.daily_recaps TO authenticated;
GRANT ALL ON public.daily_recaps TO service_role;

-- RLS
ALTER TABLE public.daily_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recaps read scoped" ON public.daily_recaps
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR is_manager(auth.uid())
  OR manager_id = auth.uid()
  OR trailer_id = current_user_trailer()
);

CREATE POLICY "recaps insert manager" ON public.daily_recaps
FOR INSERT TO authenticated
WITH CHECK (manager_id = auth.uid() AND is_manager(auth.uid()));

CREATE POLICY "recaps update" ON public.daily_recaps
FOR UPDATE TO authenticated
USING (
  (manager_id = auth.uid() AND status = 'draft')
  OR has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  (manager_id = auth.uid() AND status IN ('draft','submitted'))
  OR has_role(auth.uid(), 'owner'::app_role)
);

-- updated_at trigger
CREATE TRIGGER trg_daily_recaps_touch
BEFORE UPDATE ON public.daily_recaps
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Alert emission on submission
CREATE OR REPLACE FUNCTION public.emit_recap_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id, created_by, assigned_role, priority, status, payload)
    VALUES (
      'manager_recap',
      'Daily Recap — ' || COALESCE(v_trailer_name,'Trailer') || ' · ' || to_char(NEW.recap_date,'Mon DD'),
      'Shift score: ' || COALESCE(NEW.shift_score::text,'—') || '/10',
      'operations', NEW.id, NEW.trailer_id, NEW.manager_id, 'owner',
      'normal', 'pending',
      jsonb_build_object('recap_id', NEW.id, 'shift_score', NEW.shift_score)
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_emit_recap_alert
BEFORE UPDATE ON public.daily_recaps
FOR EACH ROW EXECUTE FUNCTION public.emit_recap_alert();
