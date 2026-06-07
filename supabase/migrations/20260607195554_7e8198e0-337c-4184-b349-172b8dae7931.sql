
-- Restrict automation_settings reads to managers/owners
DROP POLICY IF EXISTS "automation_settings read all" ON public.automation_settings;
CREATE POLICY "automation_settings read mgr"
  ON public.automation_settings
  FOR SELECT
  TO authenticated
  USING (public.is_manager(auth.uid()));

-- Restrict change_log inserts to managers (server functions use service_role and bypass RLS)
DROP POLICY IF EXISTS "change_log insert auth" ON public.change_log;
CREATE POLICY "change_log insert mgr"
  ON public.change_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_manager(auth.uid())
    AND ((actor_id = auth.uid()) OR (actor_id IS NULL))
  );
