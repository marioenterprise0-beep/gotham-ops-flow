
-- prep_log RLS
ALTER TABLE public.prep_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prep_log read scoped"
ON public.prep_log FOR SELECT
TO authenticated
USING (
  logged_by = auth.uid()
  OR is_manager(auth.uid())
  OR trailer_id = current_user_trailer()
);

CREATE POLICY "prep_log insert self"
ON public.prep_log FOR INSERT
TO authenticated
WITH CHECK (logged_by = auth.uid());

CREATE POLICY "prep_log update own or manager"
ON public.prep_log FOR UPDATE
TO authenticated
USING (logged_by = auth.uid() OR is_manager(auth.uid()))
WITH CHECK (logged_by = auth.uid() OR is_manager(auth.uid()));

CREATE POLICY "prep_log delete own or manager"
ON public.prep_log FOR DELETE
TO authenticated
USING (logged_by = auth.uid() OR is_manager(auth.uid()));

-- shift_swap_requests RLS
ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swap read scoped"
ON public.shift_swap_requests FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid()
  OR target_employee_id = auth.uid()
  OR is_manager(auth.uid())
  OR trailer_id = current_user_trailer()
);

CREATE POLICY "swap insert self"
ON public.shift_swap_requests FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid());

CREATE POLICY "swap update by manager or requester"
ON public.shift_swap_requests FOR UPDATE
TO authenticated
USING (is_manager(auth.uid()) OR requester_id = auth.uid())
WITH CHECK (is_manager(auth.uid()) OR requester_id = auth.uid());

CREATE POLICY "swap delete by manager or requester"
ON public.shift_swap_requests FOR DELETE
TO authenticated
USING (is_manager(auth.uid()) OR requester_id = auth.uid());

-- Tighten manager role-assignment to prevent self-modification
DROP POLICY IF EXISTS "roles managers write non-elevated" ON public.user_roles;

CREATE POLICY "roles managers insert non-elevated"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  is_manager(auth.uid())
  AND user_id <> auth.uid()
  AND role = ANY (ARRAY['shift_lead'::app_role,'grill'::app_role,'prep'::app_role,'cashier'::app_role])
);

CREATE POLICY "roles managers update non-elevated"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  is_manager(auth.uid())
  AND user_id <> auth.uid()
  AND role = ANY (ARRAY['shift_lead'::app_role,'grill'::app_role,'prep'::app_role,'cashier'::app_role])
)
WITH CHECK (
  is_manager(auth.uid())
  AND user_id <> auth.uid()
  AND role = ANY (ARRAY['shift_lead'::app_role,'grill'::app_role,'prep'::app_role,'cashier'::app_role])
);

CREATE POLICY "roles managers delete non-elevated"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  is_manager(auth.uid())
  AND user_id <> auth.uid()
  AND role = ANY (ARRAY['shift_lead'::app_role,'grill'::app_role,'prep'::app_role,'cashier'::app_role])
);
