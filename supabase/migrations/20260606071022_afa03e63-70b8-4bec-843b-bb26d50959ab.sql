
-- 1. alert_actions SELECT: must also satisfy alerts RLS (reuse predicate)
DROP POLICY IF EXISTS "alert actions read via alert" ON public.alert_actions;
CREATE POLICY "alert actions read via alert" ON public.alert_actions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.alerts a
  WHERE a.id = alert_actions.alert_id
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR (public.is_manager(auth.uid()) AND a.assigned_role = 'manager'::alert_assigned_role)
      OR (a.assigned_role = 'manager'::alert_assigned_role AND a.trailer_id = public.current_user_trailer())
      OR a.created_by = auth.uid()
    )
));

-- 2. tasks UPDATE: close null-owner cross-trailer bypass
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update" ON public.tasks
FOR UPDATE TO authenticated
USING (
  public.is_manager(auth.uid())
  OR owner_id = auth.uid()
  OR assignee_user_id = auth.uid()
  OR (owner_id IS NULL AND trailer_id IS NOT NULL AND trailer_id = public.current_user_trailer())
)
WITH CHECK (
  public.is_manager(auth.uid())
  OR owner_id = auth.uid()
  OR assignee_user_id = auth.uid()
  OR (owner_id IS NULL AND trailer_id IS NOT NULL AND trailer_id = public.current_user_trailer())
);

-- 3. time_punches UPDATE: allow managers (payroll corrections)
DROP POLICY IF EXISTS "punches update self open" ON public.time_punches;
CREATE POLICY "punches update self open" ON public.time_punches
FOR UPDATE TO authenticated
USING (
  (employee_id = auth.uid() AND status = 'open'::punch_status)
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.is_manager(auth.uid())
)
WITH CHECK (
  (employee_id = auth.uid() AND status = ANY (ARRAY['open'::punch_status, 'closed'::punch_status]))
  OR public.has_role(auth.uid(), 'owner'::app_role)
  OR public.is_manager(auth.uid())
);

-- 4. Realtime: remove tables from publication (no client subscribers in app)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='inventory_orders') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.inventory_orders';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='alerts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.alerts';
  END IF;
END $$;

-- 5. Fix mutable search_path on payroll_week_start
CREATE OR REPLACE FUNCTION public.payroll_week_start(_d date)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _d - ((EXTRACT(DOW FROM _d)::int + 1) % 7);
$function$;

-- 6. Lock down SECURITY DEFINER helpers from anon/public; allow authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_trailer() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_invite_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.payroll_week_start(date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_trailer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_week_start(date) TO authenticated;
