-- Phase 4: Schedules canonical archive columns
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS schedules_archived_at_idx ON public.schedules(archived_at);

ALTER TABLE public.shift_templates
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS shift_templates_archived_at_idx ON public.shift_templates(archived_at);
