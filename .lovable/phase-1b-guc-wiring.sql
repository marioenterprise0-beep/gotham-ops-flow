-- =============================================================================
-- Phase 1b — Active-organization session wiring (DRAFT, awaiting review)
-- =============================================================================
-- Problem: RLS policies invoke public.is_org_member(auth.uid(), organization_id),
-- and enforce_org_id() falls back to public.current_organization_id() (which
-- reads the app.active_organization_id GUC). Today the GUC is NEVER set by
-- the app, so:
--   • Any INSERT that omits organization_id and lacks an FK path RAISES.
--     (SELECT/UPDATE/DELETE work fine — those don't depend on the GUC, only
--     on is_org_member which reads organization_members directly.)
--   • has_role(_user_id, _role) (2-arg compat) raises "insufficient_privilege".
--
-- Constraint: Supabase-js issues each query as its own PostgREST request →
-- its own transaction. A GUC set from a serverFn's supabase.rpc('set_...')
-- call does NOT persist to the *next* supabase call. So "set it in the
-- middleware" is not sufficient; we need per-request injection at the DB.
--
-- Two viable approaches. Option A is the recommended default because it
-- requires zero server-function code changes and cannot desync from auth.
-- Option B is the classic-JWT approach; documented but not enabled below.
--
-- ============================================================================
-- OPTION A — PostgREST db-pre-request hook (RECOMMENDED, ships below)
-- ============================================================================
-- PostgREST calls this function inside every request's transaction. We
-- resolve the active org from auth.uid() → profiles.active_organization_id
-- and SET LOCAL the GUC. Persists for the whole request; resets automatically.
--
-- Cost: 1 SELECT against profiles per DB request (indexed PK lookup, ~sub-ms).

BEGIN;

CREATE OR REPLACE FUNCTION public.set_active_org_context()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN;  -- anon / service_role calls: no session context to set
  END IF;
  -- CRITICAL: verify the profile's active org against LIVE membership before
  -- stamping the session. profiles.active_organization_id is a convenience
  -- pointer that can lag revocation — a removed user must not have their
  -- requests stamped with an org they no longer belong to.
  SELECT p.active_organization_id INTO org
    FROM public.profiles p
   WHERE p.id = uid
     AND EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.user_id = uid
          AND m.organization_id = p.active_organization_id
     );
  IF org IS NOT NULL THEN
    PERFORM set_config('app.active_organization_id', org::text, true);
  END IF;
  -- If the pointer is stale or membership was revoked, we set nothing.
  -- Downstream RLS (is_org_member) then denies as it should; enforce_org_id
  -- raises with a clear message on any INSERT that needs the GUC.
END $$;

REVOKE EXECUTE ON FUNCTION public.set_active_org_context() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_active_org_context() TO authenticated, service_role;

-- Wire PostgREST to call it before every request. Requires the authenticator
-- role, which Supabase-managed migrations run as. Then reload PostgREST.
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.set_active_org_context';
NOTIFY pgrst, 'reload config';

COMMIT;

-- ---- Server-function side (no migration; documentation only) ---------------
-- After this migration, serverFn code needs NO change: every supabase.from(...)
-- and supabase.rpc(...) call from a user-authenticated client will have
-- app.active_organization_id set to the caller's profiles.active_organization_id
-- for the duration of that single request.
--
-- If a serverFn does its OWN direct pg_pool query (bypassing supabase-js), it
-- must manually run: `SELECT set_config('app.active_organization_id', $1, true)`
-- at the start of its transaction. Grep the repo for `new Pool(` / raw `pg`
-- usage — currently only scripts/test-isolation.ts does that, and it sets the
-- GUC itself.
--
-- Org-switching (Phase 2): update profiles.active_organization_id and the
-- next request picks it up automatically.

-- ============================================================================
-- OPTION B — JWT claim (documented alternative, NOT enabled here)
-- ============================================================================
-- Add a custom_access_token_hook that injects `active_organization_id` into
-- the JWT, then rewrite current_organization_id() to read from auth.jwt():
--
--   CREATE OR REPLACE FUNCTION public.current_organization_id()
--   RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
--     SELECT NULLIF(
--       coalesce(
--         current_setting('request.jwt.claims', true)::jsonb ->> 'active_organization_id',
--         current_setting('app.active_organization_id', true)
--       ), '')::uuid
--   $$;
--
-- Pros: no per-request DB round-trip; survives across every PostgREST call
--       naturally; org-switch requires token refresh (explicit + auditable).
-- Cons: needs Supabase auth-hooks config (out-of-band); org-switch UX must
--       trigger a token refresh.
-- =============================================================================
