-- Tighten user_roles writes: managers can only assign non-elevated roles
DROP POLICY IF EXISTS "roles managers write non-owner" ON public.user_roles;
CREATE POLICY "roles managers write non-elevated"
  ON public.user_roles
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_manager(auth.uid()) AND role IN ('shift_lead','grill','prep','cashier'))
  WITH CHECK (is_manager(auth.uid()) AND role IN ('shift_lead','grill','prep','cashier'));

-- Lock down profiles.email: remove column-level SELECT from authenticated.
-- App code that needs emails uses the admin client in server hooks; self-email
-- is exposed via public.my_email().
REVOKE SELECT (email) ON public.profiles FROM authenticated;
REVOKE SELECT (email) ON public.profiles FROM anon;