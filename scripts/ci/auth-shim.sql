-- Minimal auth/support shim for CI's ephemeral Postgres.
-- Applied BEFORE scripts/ci/base-schema.sql. Provides just enough of the
-- Supabase surface that the production schema dump can be replayed:
--   - roles (anon, authenticated, service_role, authenticator)
--   - auth schema + auth.users table + auth.uid()/auth.role()
-- Extension schemas (pgmq, cron, net, vault) are NOT stubbed here — every
-- reference to them lives inside plpgsql/sql function bodies dumped with
-- check_function_bodies=false, so parse validation is skipped at CREATE
-- FUNCTION time. If a future migration references those schemas at DDL
-- time (default expressions, triggers, generated columns), stub them here.
-- NEVER used against production. Applied only inside the CI service container.

DO $$ BEGIN CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- `authenticator` is the PostgREST-managed role in real Supabase. The
-- phase-1b guc-wiring path (already merged into prod, and therefore into
-- the dumped base schema) issues `ALTER ROLE authenticator ...`. Nothing
-- in the isolation suite goes through PostgREST; the role only needs to
-- exist so the dump replays cleanly.
DO $$ BEGIN CREATE ROLE authenticator NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;

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
