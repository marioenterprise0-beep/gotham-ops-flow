-- =============================================================================
-- Phase 1a — SECURITY DEFINER org-safety fixes (DRAFT, awaiting review)
-- =============================================================================
-- Follow-up to the linter file. Fixes the six pre-existing SECURITY DEFINER
-- functions that were never made org-aware by the Phase 1a migration and
-- currently either leak across tenants or accept cross-tenant references.
--
-- Ships together with:
--   • .lovable/phase-1b-guc-wiring.sql  — pre_request hook (sets GUC)
--   • .lovable/phase-1a-linter-fixes.sql — anon revoke + search_path
--   • scripts/test-isolation.ts (updated) — 8 new SECDEF assertions +
--     orgB canary rows so Group A read-isolation is non-trivial.
--
-- All eight isolation assertions in the updated suite MUST pass against a
-- DB with these fixes applied. Suite is CI-blocking.
--
-- Contract:
--   • Every function below reads current_organization_id() (the session GUC
--     stamped by set_active_org_context()). If unset, the function returns
--     an empty result or FALSE — never a cross-org fallback.
--   • decide_/request_availability_atomic additionally verify caller
--     membership before mutating, so a stale-GUC user with a spoofed
--     _trailer_id cannot stamp a row into an org they don't belong to.
-- =============================================================================

BEGIN;

-- ---- 1) is_manager: org-scoped ---------------------------------------------
-- New 2-arg overload for explicit callers.
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND organization_id = _org_id
       AND role IN ('owner','manager')
  )
$$;

-- Rewrite 1-arg to resolve org via the session GUC. If no active org,
-- return FALSE (never fall through to any-org membership).
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_organization_id() IS NULL THEN false
    ELSE public.is_manager(_user_id, public.current_organization_id())
  END
$$;

REVOKE EXECUTE ON FUNCTION public.is_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_manager(uuid, uuid) TO authenticated, service_role;

-- ---- 2) list_trailer_geofences: filter by session org ----------------------
CREATE OR REPLACE FUNCTION public.list_trailer_geofences()
RETURNS TABLE(
  id uuid, name text, geofence_lat double precision,
  geofence_lng double precision, geofence_radius_m integer, active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.geofence_lat, t.geofence_lng, t.geofence_radius_m, t.active
    FROM public.trailers t
   WHERE t.organization_id = public.current_organization_id()
     AND public.is_manager(auth.uid(), t.organization_id)
   ORDER BY t.name
$$;

-- ---- 3) get_trailer_geofence: filter by session org ------------------------
CREATE OR REPLACE FUNCTION public.get_trailer_geofence(_trailer_id uuid)
RETURNS TABLE(
  id uuid, name text, geofence_lat double precision,
  geofence_lng double precision, geofence_radius_m integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.geofence_lat, t.geofence_lng, t.geofence_radius_m
    FROM public.trailers t
   WHERE t.id = _trailer_id
     AND t.organization_id = public.current_organization_id()
     AND public.is_manager(auth.uid(), t.organization_id)
$$;

-- ---- 4) kiosk_device_required: filter by session org -----------------------
CREATE OR REPLACE FUNCTION public.kiosk_device_required()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT kiosk_device_required
       FROM public.automation_settings
      WHERE organization_id = public.current_organization_id()
        AND scope = 'global'
      LIMIT 1),
    false)
$$;

-- ---- 5) my_trailer_id: EXISTS-guard on session org -------------------------
CREATE OR REPLACE FUNCTION public.my_trailer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.trailer_id
    FROM public.profiles p
   WHERE p.id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.trailers t
        WHERE t.id = p.trailer_id
          AND t.organization_id = public.current_organization_id()
     )
$$;

-- ---- 6) current_user_trailer: EXISTS-guard on session org ------------------
CREATE OR REPLACE FUNCTION public.current_user_trailer()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidate AS (
    SELECT COALESCE(
      (SELECT g.trailer_id
         FROM public.active_location_grants g
        WHERE g.user_id = auth.uid() AND g.expires_at > now()
        ORDER BY g.expires_at DESC LIMIT 1),
      (SELECT p.trailer_id FROM public.profiles p WHERE p.id = auth.uid())
    ) AS tid
  )
  SELECT c.tid
    FROM candidate c
   WHERE c.tid IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.trailers t
        WHERE t.id = c.tid
          AND t.organization_id = public.current_organization_id()
     )
$$;

-- ---- 7) decide_availability_atomic: org-scoped manager + row org assert ----
CREATE OR REPLACE FUNCTION public.decide_availability_atomic(
  _id uuid, _decision text, _note text
)
RETURNS availability_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_row       public.availability_blocks;
  v_decider   text;
  v_org       uuid := public.current_organization_id();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no active organization';
  END IF;
  IF _decision NOT IN ('approved','declined') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  -- Load the row first and assert it belongs to the caller's session org.
  -- Definer bypasses RLS, so this check is the sole cross-tenant guard.
  SELECT * INTO v_row FROM public.availability_blocks WHERE id = _id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'availability block not found';
  END IF;
  IF v_row.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'cross-tenant reference: block % is not in active organization', _id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Org-scoped manager check (uses the same v_org, not just the GUC lookup).
  IF NOT public.is_manager(v_uid, v_org) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.availability_blocks
     SET status        = _decision,
         decided_by    = v_uid,
         decided_at    = now(),
         decision_note = NULLIF(_note,'')
   WHERE id = _id
   RETURNING * INTO v_row;

  SELECT display_name INTO v_decider FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.alerts (
    type, title, description, source_module, source_id,
    trailer_id, created_by, assigned_user_id, assigned_role,
    priority, status, payload
  ) VALUES (
    CASE WHEN _decision = 'approved' THEN 'availability_approved'
         ELSE 'availability_declined' END,
    'Unavailability ' || _decision || ' — ' || v_row.block_date::text,
    NULLIF(_note,''),
    'availability', v_row.id, v_row.trailer_id, v_uid, v_row.user_id, 'manager',
    'normal', 'pending',
    jsonb_build_object(
      'decision', _decision,
      'block_date', v_row.block_date,
      'decision_reason', NULLIF(_note,''),
      'decided_by_name', COALESCE(v_decider, 'Management')
    )
  );

  RETURN v_row;
END $$;

-- ---- 8) request_availability_atomic: caller-supplied trailer must be in org
CREATE OR REPLACE FUNCTION public.request_availability_atomic(
  _block_date date, _reason text, _requires_approval boolean,
  _trailer_id uuid, _schedule_id uuid, _schedule_name text,
  _schedule_status text, _employee_name text
)
RETURNS availability_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
  v_row    public.availability_blocks;
  v_org    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Resolve the target org strictly from the trailer FK and assert the
  -- caller is a member. Do NOT trust the session GUC alone here: the caller
  -- supplies _trailer_id, so we must reject any trailer whose org is not
  -- in the caller's live memberships.
  IF _trailer_id IS NULL THEN
    RAISE EXCEPTION 'trailer id required';
  END IF;

  SELECT t.organization_id INTO v_org
    FROM public.trailers t
   WHERE t.id = _trailer_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'trailer not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.user_id = v_uid AND m.organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'cross-tenant reference: caller is not a member of trailer''s organization'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_status := CASE WHEN _requires_approval THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.availability_blocks AS ab (
    user_id, block_date, all_day, reason, status,
    trailer_id, schedule_id, decided_by, decided_at, decision_note,
    organization_id
  ) VALUES (
    v_uid, _block_date, true, NULLIF(_reason,''), v_status,
    _trailer_id, _schedule_id, NULL, NULL, NULL,
    v_org
  )
  ON CONFLICT (user_id, block_date) DO UPDATE
    SET all_day         = EXCLUDED.all_day,
        reason          = EXCLUDED.reason,
        status          = EXCLUDED.status,
        trailer_id      = EXCLUDED.trailer_id,
        schedule_id     = EXCLUDED.schedule_id,
        organization_id = EXCLUDED.organization_id,
        decided_by      = NULL,
        decided_at      = NULL,
        decision_note   = NULL
  RETURNING * INTO v_row;

  IF _requires_approval THEN
    INSERT INTO public.alerts (
      type, title, description, source_module, source_id,
      trailer_id, created_by, assigned_role, priority, status, payload,
      organization_id
    ) VALUES (
      'availability_request',
      'Unavailability request',
      _block_date::text ||
        CASE WHEN NULLIF(_reason,'') IS NOT NULL THEN ' · ' || _reason ELSE '' END,
      'availability', v_row.id, _trailer_id, v_uid, 'manager',
      'normal', 'pending',
      jsonb_build_object(
        'request_id', v_row.id,
        'block_date', _block_date,
        'reason', NULLIF(_reason,''),
        'schedule_name', _schedule_name,
        'schedule_status', _schedule_status,
        'employee_name', COALESCE(NULLIF(_employee_name,''), 'Employee')
      ),
      v_org
    );
  END IF;

  RETURN v_row;
END $$;

COMMIT;

-- =============================================================================
-- Post-apply verification runs via `npm run test:isolation`. Expected new
-- assertions (added in scripts/test-isolation.ts, Group F):
--   F.is_manager-orgscoped               — Org-A manager in Org-B session → false
--   F.list_trailer_geofences-isolation   — Org-A manager sees 0 Org-B trailers
--   F.get_trailer_geofence-cross-org     — Org-A manager, Org-B trailer_id → 0
--   F.kiosk_device_required-per-org      — reads only the session org's row
--   F.my_trailer_id-org-guarded          — returns NULL when trailer ∉ session org
--   F.current_user_trailer-org-guarded   — returns NULL when trailer ∉ session org
--   F.decide_availability-cross-org      — Org-A mgr, Org-B block id → raise
--   F.request_availability-cross-org     — Org-A emp, Org-B trailer id → raise
-- =============================================================================
