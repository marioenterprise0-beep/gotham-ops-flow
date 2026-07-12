-- Extend stores with branding fields the app can pull from
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS support_email text;

-- Allow anon (unauthenticated) users to read basic branding so the sign-in
-- page and PWA install prompt can display the org name before login.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stores' AND policyname = 'Anyone can read store branding'
  ) THEN
    CREATE POLICY "Anyone can read store branding"
      ON public.stores
      FOR SELECT
      TO anon
      USING (archived_at IS NULL);
  END IF;
END$$;

GRANT SELECT ON public.stores TO anon;