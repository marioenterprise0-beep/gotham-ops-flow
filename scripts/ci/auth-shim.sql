-- Minimal auth schema shim for CI's ephemeral Postgres.
-- Emulates just enough of Supabase's auth surface for the isolation suite:
--   - auth.users table (id + email columns referenced by FKs and tests)
--   - auth.uid() reading from request.jwt.claims -> 'sub'
--   - authenticated / anon / service_role roles
-- NEVER used against production. Applied only inside the CI service container.

CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- `authenticator` is the PostgREST-managed role in real Supabase. The
-- phase-1b guc-wiring migration issues `ALTER ROLE authenticator ...`, so
-- the role must exist for the migration to apply cleanly against this
-- ephemeral DB. The isolation suite doesn't go through PostgREST, so the
-- pre_request hook is not exercised here — the ALTER just needs to succeed.
DO $$ BEGIN
  CREATE ROLE authenticator NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  aud text,
  role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub','')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::json ->> 'role','anon')
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO authenticated, service_role;

-- public.app_role enum is created by the pre-Phase-1a base schema in real
-- Supabase, but the ephemeral CI Postgres starts empty. The linter-fixes
-- script (.lovable/phase-1a-linter-fixes.sql) references public.app_role
-- before any migration that creates it. Define it here idempotently so the
-- isolation suite can bootstrap. Keep values in sync with the production
-- enum: owner, manager, shift_lead, grill, prep, cashier.
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'owner', 'manager', 'shift_lead', 'grill', 'prep', 'cashier'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- public.user_roles is created by the pre-Phase-1a base schema in production
-- (per-user, per-org operational roles). The Phase-1a migration's has_role
-- function bodies reference it at CREATE FUNCTION time (LANGUAGE sql bodies
-- are parse-validated on definition), so the table must exist before those
-- functions are defined. Match the production shape closely enough that the
-- has_role bodies compile; the isolation suite exercises row-level behavior
-- via inserts, not via schema introspection.
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;