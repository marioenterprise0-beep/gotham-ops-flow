
-- 1) profiles: restrict self-update to safe columns via WITH CHECK trigger
CREATE OR REPLACE FUNCTION public.profiles_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip guard for managers/super-admins; they use dedicated flows
  IF public.is_manager(auth.uid()) OR public.is_super_admin(auth.uid()) THEN
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
END $$;

DROP TRIGGER IF EXISTS profiles_self_update_guard ON public.profiles;
CREATE TRIGGER profiles_self_update_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_self_update_guard();

-- 2) profiles: scope manager reads to same trailer (super-admins see all)
DROP POLICY IF EXISTS "profiles readable to self or manager" ON public.profiles;
CREATE POLICY "profiles readable scoped"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (
      public.is_manager(auth.uid())
      AND trailer_id IS NOT DISTINCT FROM public.my_trailer_id()
    )
  );

-- 3) stores: require authentication (drop anon-readable policy)
DROP POLICY IF EXISTS "Anyone can read store branding" ON public.stores;
CREATE POLICY "stores readable to authenticated"
  ON public.stores FOR SELECT
  TO authenticated
  USING (archived_at IS NULL);

-- 4) Lock down SECURITY DEFINER functions: revoke from anon on all, and from
--    authenticated on functions that are triggers or internal-only helpers.
-- Revoke from anon on all listed SECDEF functions
REVOKE EXECUTE ON FUNCTION public._has_open_alert(alert_type, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_invite_code(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_trailer() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decide_availability_atomic(uuid, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_depths() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_trailer_geofence(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kiosk_device_required() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_trailer_geofences() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_email() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_trailer_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_availability_atomic(date, text, boolean, uuid, uuid, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_clock_sweep() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_missed_clock_in() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_missed_clock_out() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.profiles_self_update_guard() FROM anon, PUBLIC, authenticated;

-- Revoke from authenticated on internal / trigger-only helpers
REVOKE EXECUTE ON FUNCTION public._has_open_alert(alert_type, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_invite_code(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_clock_sweep() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sweep_missed_clock_in() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sweep_missed_clock_out() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) FROM authenticated;
