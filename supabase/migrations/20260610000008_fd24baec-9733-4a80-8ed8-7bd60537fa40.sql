ALTER TABLE public.cash_drawers
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS cash_drawers_archived_at_idx ON public.cash_drawers(archived_at);

ALTER TABLE public.cash_drawer_sessions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS cash_drawer_sessions_archived_at_idx ON public.cash_drawer_sessions(archived_at);

ALTER TABLE public.cash_drops
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS cash_drops_archived_at_idx ON public.cash_drops(archived_at);
