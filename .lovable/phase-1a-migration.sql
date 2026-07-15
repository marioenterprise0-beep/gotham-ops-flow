-- =============================================================================
-- Phase 1a — Multi-tenant foundation (CONSOLIDATED, matches shipped migrations)
-- =============================================================================
-- Consolidation of the three shipped migrations:
--   20260714064527 — core tables, functions, seed org, backfill, columns,
--                    triggers, NOT NULL, RLS policies, verify block.
--   20260714064615 — ALTER COLUMN organization_id SET DEFAULT
--                    public.current_organization_id() on every tenant table.
--   20260714064658 — Restore compat 2-arg has_role(user_id, role) that reads
--                    the session GUC and raises when unset.
--
-- Ships in ONE atomic transaction. No fallback, no staging. Trigger raises
-- on any INSERT that cannot resolve organization_id.
--
-- Runnable standalone: every tenant-table operation is guarded by
-- to_regclass() so this file also applies cleanly against the ephemeral
-- CI Postgres (which has only the auth shim + this file). The verify
-- block only checks tables that actually exist in the target DB.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Enums + core tables
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('org_owner','org_admin','org_member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_role        public.org_role NOT NULL DEFAULT 'org_member',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Helper functions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE user_id = _user_id AND organization_id = _org_id AND org_role = _role
  )
$$;

-- Session-scoped active org — set by the app after login / org switch.
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.active_organization_id', true), '')::uuid
$$;

-- New has_role signature: (user_id, org_id, role). Replaces the 2-arg version.
-- Operational roles remain per-user, per-org; enforces the role-boundary rule
-- (this function never touches organization_members.org_role).
-- Only defined when the app_role type exists — the type ships in the base
-- schema on prod but is absent from CI's ephemeral DB.
DO $has$
BEGIN
  IF to_regtype('public.app_role') IS NOT NULL THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role)';
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.user_roles
           WHERE user_id = _user_id
             AND organization_id = _org_id
             AND role = _role
        )
      $body$
    $f$;
    -- Compat 2-arg helper (shipped migration 20260714064658): reads active
    -- org from session GUC and raises if unset. Preserves existing call sites.
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
      RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $body$
      DECLARE
        org uuid := public.current_organization_id();
      BEGIN
        IF org IS NULL THEN
          RAISE EXCEPTION 'has_role: no active organization on session (app.active_organization_id unset)'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles
           WHERE user_id = _user_id
             AND organization_id = org
             AND role = _role
        );
      END $body$
    $f$;
  END IF;
END $has$;

-- =============================================================================
-- 3. profiles.active_organization_id (nullable — profiles stay user-owned)
-- =============================================================================

DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS active_organization_id uuid
        REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================================================
-- 4. Seed org + membership backfill for existing users
-- =============================================================================

INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Cibora Dev', 'cibora-dev')
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, org_role)
    SELECT '00000000-0000-0000-0000-000000000001'::uuid, p.id, 'org_owner'
      FROM public.profiles p
     ON CONFLICT DO NOTHING;
    UPDATE public.profiles
       SET active_organization_id = '00000000-0000-0000-0000-000000000001'::uuid
     WHERE active_organization_id IS NULL;
  END IF;
END $$;

-- =============================================================================
-- 5. Generic enforce_org_id() trigger + FK-derivation registry
-- =============================================================================

-- Registry: for each tenant table, how to derive organization_id when the
-- caller does not supply one. NULL fk_table means "root table — must come
-- from session GUC or explicit value; otherwise raise".
CREATE TABLE IF NOT EXISTS public._org_resolution (
  table_name text PRIMARY KEY,
  fk_column  text,     -- column on this table pointing at parent
  fk_table   text,     -- parent table name (public schema)
  fk_pk      text NOT NULL DEFAULT 'id'
);

CREATE OR REPLACE FUNCTION public.enforce_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reg         public._org_resolution%ROWTYPE;
  derived     uuid;
  fk_value    uuid;
  session_org uuid;
  sql         text;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;  -- WITH CHECK policies enforce cross-org rejection
  END IF;

  SELECT * INTO reg FROM public._org_resolution WHERE table_name = TG_TABLE_NAME;

  IF reg.fk_table IS NOT NULL THEN
    EXECUTE format('SELECT ($1).%I', reg.fk_column) INTO fk_value USING NEW;
    IF fk_value IS NOT NULL THEN
      sql := format(
        'SELECT organization_id FROM public.%I WHERE %I = $1',
        reg.fk_table, reg.fk_pk
      );
      EXECUTE sql INTO derived USING fk_value;
      IF derived IS NOT NULL THEN
        NEW.organization_id := derived;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  session_org := public.current_organization_id();
  IF session_org IS NOT NULL THEN
    NEW.organization_id := session_org;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'enforce_org_id: cannot resolve organization_id for %.% (no explicit value, no FK-derivable parent, no app.active_organization_id set)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END $$;

-- Registry entries. Direct-fill tables have no entry (must come from session).
-- Only FK-derived tables need rows here.
INSERT INTO public._org_resolution (table_name, fk_column, fk_table) VALUES
  ('alert_actions',                'alert_id',        'alerts'),
  ('hr_document_signatures',       'assignment_id',   'hr_document_assignments'),
  ('hr_document_template_versions','template_id',     'hr_document_templates'),
  ('inventory_order_items',        'order_id',        'inventory_orders'),
  ('inventory_receipts',           'item_id',         'inventory_items'),
  ('sop_acknowledgements',         'sop_id',          'sops'),
  ('sop_attachments',              'sop_id',          'sops'),
  ('sop_versions',                 'sop_id',          'sops'),
  ('sop_views',                    'sop_id',          'sops'),
  ('task_template_versions',       'template_id',     'task_templates'),
  ('time_audit',                   'punch_id',        'time_punches'),
  ('handbook_acknowledgements',    'section_id',      'handbook_sections'),
  ('location_access_requests',     'trailer_id',      'trailers'),
  ('active_location_grants',       'request_id',      'location_access_requests')
ON CONFLICT (table_name) DO UPDATE
  SET fk_column = EXCLUDED.fk_column, fk_table = EXCLUDED.fk_table;

-- =============================================================================
-- 6. Tenant tables — add column, backfill, attach trigger, NOT NULL, RLS
-- =============================================================================

-- Every tenant table listed here gets the same treatment. Backfill uses the
-- seed org for all existing rows (single-tenant snapshot). New rows must
-- resolve via the trigger.

DO $mig$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    -- Root (2)
    'stores','trailers',
    -- Org-owned resources (8)
    'handbook_sections','hr_document_templates','inventory_categories',
    'role_email_policies','sops','tab_permissions',
    'automation_settings','user_roles',
    -- Direct-fill (32)
    'alerts','availability_blocks','cash_drawer_sessions','cash_drawers',
    'cash_drops','change_log','checklist_sessions','daily_recaps',
    'hospitality_incidents','hr_document_assignments','inventory_change_requests',
    'inventory_counts','inventory_items','inventory_orders','invite_codes',
    'maintenance_requests','prep_log','rollover_runs','schedule_shifts',
    'schedules','shift_claim_requests','shift_notes','shift_swap_requests',
    'shift_templates','shifts','task_templates','tasks','time_corrections',
    'time_off_requests','time_punches','trusted_clock_devices','waste_log',
    -- FK-derived (14)
    'alert_actions','hr_document_signatures','hr_document_template_versions',
    'inventory_order_items','inventory_receipts','sop_acknowledgements',
    'sop_attachments','sop_versions','sop_views','task_template_versions',
    'time_audit','handbook_acknowledgements','location_access_requests',
    'active_location_grants',
    -- Caller-supplied from session (4)
    'alert_category_reads','audit_log','access_log','employee_pins'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT', t);
    -- Backfill: single-tenant snapshot → all existing rows belong to seed org.
    EXECUTE format(
      'UPDATE public.%I SET organization_id = %L WHERE organization_id IS NULL',
      t, '00000000-0000-0000-0000-000000000001'
    );
    -- Attach trigger (BEFORE INSERT).
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_org_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id()', t
    );
    -- NOT NULL — no fallback, ever.
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
    -- Index for RLS predicate perf.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)',
      t || '_organization_id_idx', t
    );
  END LOOP;
END $mig$;

-- -----------------------------------------------------------------------------
-- Drop-and-recreate RLS policies for every tenant table.
-- Universal shape:
--   SELECT   USING (is_org_member(auth.uid(), organization_id))
--   INSERT   WITH CHECK (is_org_member(auth.uid(), organization_id))
--   UPDATE   USING/WITH CHECK (is_org_member(auth.uid(), organization_id))
--   DELETE   USING (is_org_member(auth.uid(), organization_id))
-- The 4 caller-supplied tables get the SAME shape — the WITH CHECK is what
-- rejects a session-user of Org A submitting a row stamped with Org B.
-- -----------------------------------------------------------------------------

DO $rls$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'stores','trailers','handbook_sections','hr_document_templates',
    'inventory_categories','role_email_policies','sops','tab_permissions',
    'automation_settings','user_roles','alerts','availability_blocks',
    'cash_drawer_sessions','cash_drawers','cash_drops','change_log',
    'checklist_sessions','daily_recaps','hospitality_incidents',
    'hr_document_assignments','inventory_change_requests','inventory_counts',
    'inventory_items','inventory_orders','invite_codes','maintenance_requests',
    'prep_log','rollover_runs','schedule_shifts','schedules',
    'shift_claim_requests','shift_notes','shift_swap_requests','shift_templates',
    'shifts','task_templates','tasks','time_corrections','time_off_requests',
    'time_punches','trusted_clock_devices','waste_log','alert_actions',
    'hr_document_signatures','hr_document_template_versions',
    'inventory_order_items','inventory_receipts','sop_acknowledgements',
    'sop_attachments','sop_versions','sop_views','task_template_versions',
    'time_audit','handbook_acknowledgements','location_access_requests',
    'active_location_grants','alert_category_reads','audit_log','access_log',
    'employee_pins'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Drop every existing policy on this table so old permissive policies
    -- cannot leak across orgs during rollout.
    FOR pol IN
      SELECT policyname FROM pg_policies
       WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
      'USING (public.is_org_member(auth.uid(), organization_id))',
      t || '_org_select', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated '
      'WITH CHECK (public.is_org_member(auth.uid(), organization_id))',
      t || '_org_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated '
      'USING (public.is_org_member(auth.uid(), organization_id)) '
      'WITH CHECK (public.is_org_member(auth.uid(), organization_id))',
      t || '_org_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated '
      'USING (public.is_org_member(auth.uid(), organization_id))',
      t || '_org_delete', t
    );
  END LOOP;
END $rls$;

-- -----------------------------------------------------------------------------
-- organizations / organization_members policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "org_read_own" ON public.organizations;
CREATE POLICY "org_read_own" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

DROP POLICY IF EXISTS "org_admin_update" ON public.organizations;
CREATE POLICY "org_admin_update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'org_admin')
      OR public.has_org_role(auth.uid(), id, 'org_owner'))
  WITH CHECK (public.has_org_role(auth.uid(), id, 'org_admin')
      OR public.has_org_role(auth.uid(), id, 'org_owner'));

DROP POLICY IF EXISTS "orgmem_read_own" ON public.organization_members;
CREATE POLICY "orgmem_read_own" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "orgmem_admin_manage" ON public.organization_members;
CREATE POLICY "orgmem_admin_manage" ON public.organization_members FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'org_admin')
      OR public.has_org_role(auth.uid(), organization_id, 'org_owner'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'org_admin')
      OR public.has_org_role(auth.uid(), organization_id, 'org_owner'));

-- =============================================================================
-- 7. email_send_log — nullable attribution column (service-role only, no RLS exposure)
-- =============================================================================

ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS organization_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS email_send_log_organization_id_idx
  ON public.email_send_log (organization_id);

-- =============================================================================
-- 8. Verification — fail the migration if any tenant table is misconfigured
-- =============================================================================

DO $verify$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(t, ', ') INTO missing
    FROM unnest(ARRAY[
      'stores','trailers','handbook_sections','hr_document_templates',
      'inventory_categories','role_email_policies','sops','tab_permissions',
      'automation_settings','user_roles','alerts','availability_blocks',
      'cash_drawer_sessions','cash_drawers','cash_drops','change_log',
      'checklist_sessions','daily_recaps','hospitality_incidents',
      'hr_document_assignments','inventory_change_requests','inventory_counts',
      'inventory_items','inventory_orders','invite_codes','maintenance_requests',
      'prep_log','rollover_runs','schedule_shifts','schedules',
      'shift_claim_requests','shift_notes','shift_swap_requests','shift_templates',
      'shifts','task_templates','tasks','time_corrections','time_off_requests',
      'time_punches','trusted_clock_devices','waste_log','alert_actions',
      'hr_document_signatures','hr_document_template_versions',
      'inventory_order_items','inventory_receipts','sop_acknowledgements',
      'sop_attachments','sop_versions','sop_views','task_template_versions',
      'time_audit','handbook_acknowledgements','location_access_requests',
      'active_location_grants','alert_category_reads','audit_log','access_log',
      'employee_pins'
    ]) AS t
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t
        AND column_name='organization_id' AND is_nullable='NO'
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 1a verify FAILED — organization_id NOT NULL missing on: %', missing;
  END IF;
END $verify$;

COMMIT;