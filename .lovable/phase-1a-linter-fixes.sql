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
--              PER-FUNCTION ORG-SAFETY REVIEW (12 distinct, some overloaded).
--              "Pre-existing" is not a justification — every function is
--              re-evaluated against Phase-1a semantics below.
--
--              SAFE — no change required:
--                • my_email()          — returns caller's own email by
--                                        auth.uid(). Self-scoped.
--                • is_super_admin()    — platform-level flag; deliberately
--                                        cross-org (super-admin is not a
--                                        tenant role).
--                • enqueue_email()     — pgmq passthrough. Payload attribution
--                                        is the caller's job; queue rows carry
--                                        no RLS surface.
--                • email_queue_depths()— global queue counts, no row content.
--                                        Ops metric.
--
--              UNSAFE — Phase 1a broke or never established org isolation.
--              These do NOT get a waiver. Remediation SQL will land in a
--              follow-up migration (.lovable/phase-1a-secdef-org-fixes.sql,
--              drafted next for your review — NOT bundled with this file):
--
--                • is_manager(_user_id)
--                    Reads user_roles with no organization_id filter. After
--                    Phase 1a user_roles is org-scoped, so this returns true
--                    globally for anyone who is a manager in ANY org. Every
--                    gate that reads it inherits the bug.
--                    Fix: add _org_id param defaulting to
--                    current_organization_id(); keep 1-arg overload only for
--                    session-scoped calls that resolve org via the GUC.
--                    Isolation assertion: Org-A manager, session-switched to
--                    Org B, must get is_manager() = false.
--
--                • list_trailer_geofences()
--                    Returns every trailer where caller is any manager —
--                    cross-tenant leak.
--                    Fix: `AND t.organization_id = current_organization_id()`
--                    and use org-scoped is_manager.
--                    Isolation assertion (Group A read): Org-A manager sees
--                    0 Org-B trailers. Requires the orgB canary rows
--                    (see suite carry-over).
--
--                • get_trailer_geofence(_trailer_id)
--                    Same is_manager bug + no assertion _trailer_id ∈ caller
--                    org.
--                    Fix: filter by organization_id = current_organization_id().
--                    Isolation assertion: Org-A manager passing Org-B trailer
--                    id → 0 rows.
--
--                • kiosk_device_required()
--                    Reads automation_settings.scope='global'. Table is now
--                    org-scoped; returns whichever org's row happens to sort
--                    first — nondeterministic across tenants.
--                    Fix: filter organization_id = current_organization_id().
--                    Read assertion: Org-A caller reads Org-A value only.
--
--                • my_trailer_id() / current_user_trailer()
--                    Return a trailer id without asserting its org matches
--                    the session GUC. Downstream RLS on trailers denies the
--                    id, but the value should never have been returned.
--                    Fix: EXISTS-guard on trailers where
--                    organization_id = current_organization_id().
--                    Read assertion in suite.
--
--                • decide_availability_atomic(_id, _decision, _note)  [MUTATES]
--                    Gated by broken is_manager; loads the block by id with
--                    no org check. Org-A manager could pass an Org-B block id
--                    and update it (definer bypasses RLS).
--                    Fix: (1) org-scoped is_manager; (2) assert
--                    v_row.organization_id = current_organization_id()
--                    before UPDATE; raise 'cross-tenant reference' otherwise.
--                    Isolation assertion (REQUIRED — mutation): Org-A manager
--                    calling with Org-B availability_blocks.id must raise.
--
--                • request_availability_atomic(_trailer_id, ...)      [MUTATES]
--                    Caller supplies _trailer_id verbatim. Org-A employee
--                    can stamp a row against an Org-B trailer; enforce_org_id
--                    then derives Org B from the FK and RLS accepts the row
--                    into Org B.
--                    Fix: assert _trailer_id belongs to a trailer whose
--                    organization_id is in the caller's memberships before
--                    INSERT.
--                    Isolation assertion (REQUIRED — mutation): Org-A employee
--                    calling with Org-B trailer id must raise.
--
--              The linter migration below does NOT waive these — it only
--              revokes anon and normalizes search_path. The unsafe six get
--              their own migration and their own review gate.
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
