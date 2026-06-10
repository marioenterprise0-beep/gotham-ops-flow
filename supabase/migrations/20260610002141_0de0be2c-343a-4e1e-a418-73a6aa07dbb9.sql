ALTER TABLE public.inventory_counts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_inventory_counts_archived_at ON public.inventory_counts(archived_at);

ALTER TABLE public.trailers
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_trailers_archived_at ON public.trailers(archived_at);

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_stores_archived_at ON public.stores(archived_at);