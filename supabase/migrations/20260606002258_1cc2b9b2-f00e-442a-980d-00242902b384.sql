
-- Tighten WITH CHECK on permissive policies
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
CREATE POLICY "tasks insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update" ON public.tasks
  FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR (owner_id IS NULL) OR public.is_manager(auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR (owner_id IS NULL) OR public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "shifts update" ON public.shifts;
CREATE POLICY "shifts update" ON public.shifts
  FOR UPDATE TO authenticated
  USING ((opened_by = auth.uid()) OR public.is_manager(auth.uid()))
  WITH CHECK ((opened_by = auth.uid()) OR public.is_manager(auth.uid()));

-- Lock down SECURITY DEFINER functions that should not be callable via the Data API.
-- consume_invite_code, handle_new_user, touch_updated_at are only used by triggers or internally.
REVOKE EXECUTE ON FUNCTION public.consume_invite_code(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;

-- is_manager / has_role are referenced inside RLS policies, so authenticated must keep EXECUTE.
-- Revoke from anon only (no anonymous access expected on protected tables).
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
