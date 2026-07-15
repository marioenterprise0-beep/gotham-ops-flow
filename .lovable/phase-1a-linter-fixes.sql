-- =============================================================================
-- Phase 1a linter audit — remediation (DRAFT, awaiting review)
-- =============================================================================
-- Addresses the 27 findings from supabase--linter, grouped by category. Each
-- group cites the specific object(s) so you can audit before submit.
--
-- Findings summary (from the DB, not just the linter counts):
--   INFO x 2 : RLS Enabled No Policy
--              → cron_dispatch_config, email_dispatch_config
--              → INTENTIONAL. Config singletons touched only by DB jobs;
--                service_role bypasses RLS. Adding a "deny all" empty policy
--                set is the desired shape. No SQL change needed — document
--                and ignore in security memory. (Not touched below.)
--
--   ERROR x 1: RLS Disabled in Public
--              → public._org_resolution  (new Phase 1a registry)
--              → Fix: enable RLS with NO policies. Trigger function is
--                SECURITY DEFINER and reads it via the definer's privileges,
--                bypassing the empty policy set. Clients get zero access.
--
--   WARN x 1 : Function Search Path Mutable
--              → public.current_organization_id()
--              → Fix: recreate with SET search_path = public.
--
--   WARN x 5 : Public (anon) Can Execute SECURITY DEFINER Function
--              → enforce_org_id, has_org_role, has_role/2, has_role/3,
--                is_org_member  (all shipped by Phase 1a)
--              → Fix: REVOKE EXECUTE FROM PUBLIC, anon. Keep GRANT to
--                authenticated for RLS-policy invocation and to service_role
--                for admin flows.
--                enforce_org_id is a trigger function only — revoke from
--                all client roles.
--
--   WARN x 17: Signed-In Users Can Execute SECURITY DEFINER Function
--              → is_manager, is_super_admin, my_trailer_id, my_email,
--                kiosk_device_required, current_user_trailer,
--                get_trailer_geofence, list_trailer_geofences,
--                email_queue_depths, enqueue_email,
--                decide_availability_atomic, request_availability_atomic
--                (and 5 more RLS helpers)
--              → INTENTIONAL exposure. These are the app's RPC surface and
--                RLS-helper functions — authenticated users MUST call them.
--                No SQL change; document in security memory and mark the
--                findings ignored with justification.
--
--   WARN x 1 : Extension in Public
--              → pg_net (Supabase-managed; used by notify_alert_email trigger)
--              → Moving requires updating triggers + Supabase-managed
--                extension migration. Defer to Phase 1b infra pass.
-- =============================================================================

BEGIN;

-- ---- ERROR: RLS on _org_resolution -----------------------------------------
ALTER TABLE public._org_resolution ENABLE ROW LEVEL SECURITY;
-- No policies. SECURITY DEFINER enforce_org_id() runs as owner and reads it
-- regardless. Clients (anon/authenticated) get an empty set.
REVOKE ALL ON public._org_resolution FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public._org_resolution TO service_role;

-- ---- WARN: current_organization_id search_path -----------------------------
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('app.active_organization_id', true), '')::uuid
$$;

-- ---- WARN: anon-exec on SECURITY DEFINER helpers ---------------------------
-- enforce_org_id is a trigger — no client should call it.
REVOKE EXECUTE ON FUNCTION public.enforce_org_id() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enforce_org_id() TO service_role;

-- RLS helpers: revoke from anon and PUBLIC; keep authenticated + service_role.
DO $g$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.is_org_member(uuid, uuid)',
    'public.has_org_role(uuid, uuid, public.org_role)',
    'public.has_role(uuid, public.app_role)',
    'public.has_role(uuid, uuid, public.app_role)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $g$;

COMMIT;

-- =============================================================================
-- Post-apply verification (run manually after submit):
--   SELECT * FROM public.cron_dispatch_config; -- as authenticated → 0 rows
--   SELECT * FROM public._org_resolution;      -- as authenticated → error/0
--   SELECT public.current_organization_id();   -- unchanged behavior
-- =============================================================================
