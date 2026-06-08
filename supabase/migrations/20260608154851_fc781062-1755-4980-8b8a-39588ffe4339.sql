DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'profiles_with_email'
  ) THEN
    EXECUTE 'REVOKE SELECT ON public.profiles_with_email FROM authenticated';
  END IF;
END $$;

DROP POLICY IF EXISTS "active_location_grants self read" ON public.active_location_grants;
DROP POLICY IF EXISTS "grants self read" ON public.active_location_grants;
DROP POLICY IF EXISTS "grants self create" ON public.active_location_grants;
DROP POLICY IF EXISTS "grants self delete" ON public.active_location_grants;

CREATE POLICY "grants self read"
  ON public.active_location_grants
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "grants self create"
  ON public.active_location_grants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "grants self delete"
  ON public.active_location_grants
  FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'owner'::public.app_role));