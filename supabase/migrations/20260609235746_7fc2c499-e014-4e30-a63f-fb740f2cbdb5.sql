ALTER TABLE public.time_punches
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS time_punches_archived_at_idx ON public.time_punches(archived_at);

ALTER TABLE public.time_corrections
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS time_corrections_archived_at_idx ON public.time_corrections(archived_at);

ALTER TABLE public.time_off_requests
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS time_off_requests_archived_at_idx ON public.time_off_requests(archived_at);
