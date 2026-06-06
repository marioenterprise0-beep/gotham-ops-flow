
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS assigned_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_alerts_assigned_user ON public.alerts(assigned_user_id, status);

ALTER TYPE alert_assigned_role ADD VALUE IF NOT EXISTS 'all';
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'announcement';
