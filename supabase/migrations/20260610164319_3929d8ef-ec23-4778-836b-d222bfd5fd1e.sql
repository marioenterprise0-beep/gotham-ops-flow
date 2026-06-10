
-- 1) Add archive metadata columns to inventory_items (fixes archive center runtime error)
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- 2) Convert category from enum to text so new categories don't need DDL
ALTER TABLE public.inventory_items
  ALTER COLUMN category TYPE text USING category::text;

-- Drop the old enum if it has no remaining dependents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_category') THEN
    BEGIN
      DROP TYPE public.inventory_category;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      NULL;
    END;
  END IF;
END $$;

-- 3) Categories catalog
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archive_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.inventory_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_categories TO authenticated;
GRANT ALL ON public.inventory_categories TO service_role;

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_categories read all authed"
  ON public.inventory_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "inventory_categories owner insert"
  ON public.inventory_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "inventory_categories owner update"
  ON public.inventory_categories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "inventory_categories owner delete"
  ON public.inventory_categories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- 4) Seed defaults
INSERT INTO public.inventory_categories (key, label, sort_order) VALUES
  ('protein',   'Proteins',      10),
  ('bun',       'Buns & Bread',  20),
  ('sauce',     'Sauces',        30),
  ('produce',   'Produce',       40),
  ('dairy',     'Dairy',         50),
  ('packaging', 'Packaging',     60),
  ('supplies', 'Supplies',       70)
ON CONFLICT (key) DO NOTHING;
