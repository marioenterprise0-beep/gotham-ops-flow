
-- 1) Hide profiles.email from non-managers via column-level grants
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, store_id, trailer_id, active, sop_accepted_at, training_completed_at, last_login_at, created_at, updated_at) ON public.profiles TO authenticated;
-- Email access requires manager/owner via separate policy + view (use SECURITY DEFINER function for self-read)
CREATE OR REPLACE FUNCTION public.my_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_email() FROM public;
GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;

-- Provide email access to managers/owners via a view
CREATE OR REPLACE VIEW public.profiles_with_email
  WITH (security_invoker = true) AS
  SELECT * FROM public.profiles WHERE is_manager(auth.uid());
GRANT SELECT ON public.profiles_with_email TO authenticated;

-- 2) user_roles: split write policy so only owners can grant 'owner'
DROP POLICY IF EXISTS "roles managers write" ON public.user_roles;
CREATE POLICY "roles managers write non-owner" ON public.user_roles
  FOR ALL TO authenticated
  USING (is_manager(auth.uid()) AND role <> 'owner'::app_role)
  WITH CHECK (is_manager(auth.uid()) AND role <> 'owner'::app_role);
CREATE POLICY "roles owners write owner" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- 3) Scope schedules/shifts/templates to user's trailer
DROP POLICY IF EXISTS "schedules_select_auth" ON public.schedules;
CREATE POLICY "schedules read scoped" ON public.schedules
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR trailer_id IS NULL);

DROP POLICY IF EXISTS "schedule_shifts_select_auth" ON public.schedule_shifts;
CREATE POLICY "schedule_shifts read scoped" ON public.schedule_shifts
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR employee_id = auth.uid());

DROP POLICY IF EXISTS "shift_templates_select_auth" ON public.shift_templates;
CREATE POLICY "shift_templates read scoped" ON public.shift_templates
  FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer() OR trailer_id IS NULL);

-- 4) Hide trailer geofence columns from non-managers via column grants
REVOKE SELECT ON public.trailers FROM authenticated;
-- Grant SELECT on all columns EXCEPT the sensitive geofence_* ones
DO $$
DECLARE col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO col_list
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='trailers'
     AND column_name NOT IN ('geofence_lat','geofence_lng','geofence_radius_m');
  EXECUTE format('GRANT SELECT (%s) ON public.trailers TO authenticated', col_list);
END $$;
-- Managers/owners get all columns via a view
CREATE OR REPLACE VIEW public.trailers_with_geofence
  WITH (security_invoker = true) AS
  SELECT * FROM public.trailers WHERE is_manager(auth.uid());
GRANT SELECT ON public.trailers_with_geofence TO authenticated;
