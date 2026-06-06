
DROP POLICY IF EXISTS "alerts read scoped" ON public.alerts;
CREATE POLICY "alerts read scoped" ON public.alerts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR (is_manager(auth.uid()) AND assigned_role = 'manager'::alert_assigned_role)
  OR (assigned_role = 'manager'::alert_assigned_role AND trailer_id = current_user_trailer())
  OR (created_by = auth.uid())
  OR (assigned_user_id = auth.uid())
  OR (assigned_role = 'all'::alert_assigned_role)
);
