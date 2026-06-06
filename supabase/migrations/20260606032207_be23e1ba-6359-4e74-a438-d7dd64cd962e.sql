
-- Add access_level to tab_permissions: 'none' | 'view' | 'edit'
ALTER TABLE public.tab_permissions
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'edit'
  CHECK (access_level IN ('none','view','edit'));

-- Backfill from legacy boolean
UPDATE public.tab_permissions
SET access_level = CASE WHEN enabled THEN 'edit' ELSE 'none' END
WHERE access_level = 'edit' AND enabled = false;
