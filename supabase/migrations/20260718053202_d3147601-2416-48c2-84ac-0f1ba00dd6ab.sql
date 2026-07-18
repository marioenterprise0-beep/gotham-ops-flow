BEGIN;

CREATE OR REPLACE FUNCTION public.profiles_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org uuid := public.current_organization_id();
BEGIN
  IF (_org IS NOT NULL AND public.is_manager(auth.uid(), _org))
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR OLD.id <> auth.uid() THEN
    RETURN NEW;
  END IF;
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     OR NEW.pay_rate     IS DISTINCT FROM OLD.pay_rate
     OR NEW.trailer_id   IS DISTINCT FROM OLD.trailer_id
     OR NEW.store_id     IS DISTINCT FROM OLD.store_id
     OR NEW.active       IS DISTINCT FROM OLD.active
     OR NEW.archived_at  IS DISTINCT FROM OLD.archived_at
     OR NEW.archived_by  IS DISTINCT FROM OLD.archived_by
     OR NEW.archive_reason IS DISTINCT FROM OLD.archive_reason
     OR NEW.email        IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'forbidden: cannot edit privileged profile fields';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.hr_assignment_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org uuid := public.current_organization_id();
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF _org IS NOT NULL AND public.is_manager(auth.uid(), _org) THEN
    RETURN NEW;
  END IF;

  IF OLD.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: cannot edit another employee''s assignment';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'viewed') THEN
      RAISE EXCEPTION 'forbidden: employees cannot change assignment status';
    END IF;
  END IF;

  IF NEW.voided_at         IS DISTINCT FROM OLD.voided_at
   OR NEW.voided_by         IS DISTINCT FROM OLD.voided_by
   OR NEW.void_reason       IS DISTINCT FROM OLD.void_reason
   OR NEW.completed_at      IS DISTINCT FROM OLD.completed_at
   OR NEW.completed_pdf_path IS DISTINCT FROM OLD.completed_pdf_path
   OR NEW.title             IS DISTINCT FROM OLD.title
   OR NEW.body_blocks       IS DISTINCT FROM OLD.body_blocks
   OR NEW.template_id       IS DISTINCT FROM OLD.template_id
   OR NEW.employee_id       IS DISTINCT FROM OLD.employee_id
   OR NEW.assigned_by       IS DISTINCT FROM OLD.assigned_by
   OR NEW.required_signer_roles IS DISTINCT FROM OLD.required_signer_roles
   OR NEW.category          IS DISTINCT FROM OLD.category
  THEN
    RAISE EXCEPTION 'forbidden: employees can only update viewed_at and field_values on their own assignment';
  END IF;

  RETURN NEW;
END $function$;

DROP POLICY IF EXISTS "prefs self read" ON public.notification_preferences;
CREATE POLICY "prefs self read"
  ON public.notification_preferences
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_manager(auth.uid(), public.current_organization_id())
  );

DROP POLICY IF EXISTS "profiles managers edit any" ON public.profiles;
CREATE POLICY "profiles managers edit any"
  ON public.profiles
  FOR UPDATE
  USING (public.is_manager(auth.uid(), public.current_organization_id()))
  WITH CHECK (public.is_manager(auth.uid(), public.current_organization_id()));

DROP POLICY IF EXISTS "profiles readable scoped" ON public.profiles;
CREATE POLICY "profiles readable scoped"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (
      public.is_manager(auth.uid(), public.current_organization_id())
      AND NOT (trailer_id IS DISTINCT FROM public.my_trailer_id())
    )
  );

DROP POLICY IF EXISTS "weekly_rollup_runs read managers" ON public.weekly_rollup_runs;
CREATE POLICY "weekly_rollup_runs read managers"
  ON public.weekly_rollup_runs
  FOR SELECT
  USING (public.is_manager(auth.uid(), public.current_organization_id()));

DROP POLICY IF EXISTS "gotham_photos_read_own_or_manager" ON storage.objects;
CREATE POLICY "gotham_photos_read_own_or_manager"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'gotham-photos'
    AND (
      owner = auth.uid()
      OR public.is_manager(auth.uid(), public.current_organization_id())
    )
  );

DROP POLICY IF EXISTS "sop_photos_delete_mgr" ON storage.objects;
CREATE POLICY "sop_photos_delete_mgr"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'gotham-photos'
    AND public.is_manager(auth.uid(), public.current_organization_id())
  );

DROP POLICY IF EXISTS "sop_photos_write_mgr" ON storage.objects;
CREATE POLICY "sop_photos_write_mgr"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'gotham-photos'
    AND public.is_manager(auth.uid(), public.current_organization_id())
  );

CREATE OR REPLACE VIEW public.profiles_with_email AS
  SELECT id,
     display_name,
     store_id,
     created_at,
     updated_at,
     trailer_id,
     last_login_at,
     sop_accepted_at,
     training_completed_at,
     active,
     email
  FROM public.profiles
  WHERE public.is_manager(auth.uid(), public.current_organization_id());

DROP FUNCTION IF EXISTS public.is_manager(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.my_active_org_roles();

DO $$
DECLARE
  _cnt int;
BEGIN
  SELECT count(*) INTO _cnt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (
      (p.proname = 'is_manager' AND pg_get_function_identity_arguments(p.oid) = '_user_id uuid')
      OR (p.proname = 'has_role' AND pg_get_function_identity_arguments(p.oid) = '_user_id uuid, _role app_role')
      OR (p.proname = 'my_active_org_roles' AND pg_get_function_identity_arguments(p.oid) = '')
    );
  IF _cnt <> 0 THEN
    RAISE EXCEPTION 'phase-1c: legacy overloads still present (found %)', _cnt;
  END IF;
END$$;

COMMIT;