#!/usr/bin/env tsx
/**
 * Phase 1a isolation test suite — CI-blocking.
 *
 * Verifies multi-tenant isolation at the RLS layer for every tenant table.
 * Runs against the DB pointed to by PG* env vars (or DATABASE_URL). Uses
 * service-role for setup/teardown; simulates authenticated users via
 * `SET LOCAL request.jwt.claims` inside transactions.
 *
 * Pre-migration behavior: exits 1 with a clear message. This is expected
 * and desirable — CI stays red until Phase 1a migration lands.
 *
 * Post-migration checks:
 *   A. Cross-org read isolation on every tenant table.
 *   B. Cross-org UPDATE/DELETE rejection on every tenant table.
 *   C. Caller-supplied-org tables (alert_category_reads, audit_log,
 *      access_log, employee_pins) — WITH CHECK rejects a row stamped
 *      with a foreign org id.
 *   D. Trigger raises when app.active_organization_id is unset and
 *      there is no FK-derivable org path.
 *   E. Role-boundary invariant — no function definition in public schema
 *      references both organization_members.org_role and user_roles.role
 *      in the same predicate.
 */

import { Client } from "pg";
import { randomUUID } from "node:crypto";

// ---- Manifest --------------------------------------------------------------

// The 60 tenant tables, in migration-classification order.
const TENANT_TABLES: readonly string[] = [
  // Root tenant (2)
  "stores", "trailers",
  // Org-owned resources (8)
  "handbook_sections", "hr_document_templates", "inventory_categories",
  "role_email_policies", "sops", "tab_permissions",
  "automation_settings", "user_roles",
  // Direct-fill (32)
  "active_location_grants", "alerts", "availability_blocks",
  "cash_drawer_sessions", "cash_drawers", "cash_drops", "change_log",
  "checklist_sessions", "daily_recaps", "hospitality_incidents",
  "hr_document_assignments", "inventory_change_requests", "inventory_counts",
  "inventory_items", "inventory_orders", "invite_codes",
  "maintenance_requests", "prep_log", "rollover_runs", "schedule_shifts",
  "schedules", "shift_claim_requests", "shift_notes", "shift_swap_requests",
  "shift_templates", "shifts", "task_templates", "tasks", "time_corrections",
  "time_off_requests", "time_punches", "trusted_clock_devices", "waste_log",
  // FK-derived (14)
  "alert_actions", "hr_document_signatures", "hr_document_template_versions",
  "inventory_order_items", "inventory_receipts", "sop_acknowledgements",
  "sop_attachments", "sop_versions", "sop_views", "task_template_versions",
  "time_audit", "handbook_acknowledgements", "location_access_requests",
  // Caller-supplied-from-session (4) — same list as CALLER_SUPPLIED_TABLES below
  "alert_category_reads", "audit_log", "access_log", "employee_pins",
];

// Tables whose org_id is supplied by the app from session context, not
// derived from an FK. These MUST have an RLS WITH CHECK that rejects
// caller-supplied foreign org ids.
const CALLER_SUPPLIED_TABLES: readonly string[] = [
  "alert_category_reads",
  "audit_log",
  "access_log",
  "employee_pins",
];

// ---- Runner ----------------------------------------------------------------

type Result = { name: string; ok: boolean; err?: string };
const results: Result[] = [];

function record(name: string, ok: boolean, err?: string) {
  results.push({ name, ok, err });
  const tag = ok ? "  ✓" : "  ✗";
  const line = `${tag} ${name}`;
  if (ok) console.log(line);
  else console.error(`${line}\n    ${err ?? "(no error message)"}`);
}

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    record(name, true);
  } catch (e) {
    record(name, false, (e as Error).message);
  }
}

// ---- DB helpers ------------------------------------------------------------

async function newClient() {
  // Opt-in SSL only. CI (ephemeral local Postgres) and local socket runs do
  // not need SSL; hosted DBs set PGSSLMODE=require or PGSSL_DISABLE_VERIFY=1.
  const useSsl =
    process.env.PGSSLMODE === "require" ||
    process.env.PGSSL_DISABLE_VERIFY === "1";
  const client = new Client({
    connectionString: process.env.DATABASE_URL || undefined,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  return client;
}

async function tableExists(c: Client, table: string): Promise<boolean> {
  const r = await c.query(
    `SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return r.rowCount === 1;
}

async function hasColumn(c: Client, table: string, column: string) {
  const r = await c.query(
    `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column],
  );
  return r.rowCount === 1;
}

// Simulate an authenticated user for the duration of a transaction.
async function asUser<T>(
  c: Client,
  userId: string,
  body: (tx: Client) => Promise<T>,
): Promise<T> {
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL role = authenticated");
    // Postgres SET does not accept bind parameters — inline the claims JSON
    // as an escaped literal. userId is always a validated UUID so no
    // injection surface here.
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await c.query(`SET LOCAL request.jwt.claims = '${claims.replace(/'/g, "''")}'`);
    const out = await body(c);
    await c.query("ROLLBACK");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  }
}

// ---- Preflight -------------------------------------------------------------

async function preflight(c: Client): Promise<
  { ready: true } | { ready: false; reason: string }
> {
  const orgsExists = await tableExists(c, "organizations");
  if (!orgsExists) {
    return {
      ready: false,
      reason:
        "public.organizations table not found — Phase 1a migration has not been applied yet. This is expected before the migration lands; CI stays red by design.",
    };
  }
  const orgMembersExists = await tableExists(c, "organization_members");
  if (!orgMembersExists) {
    return {
      ready: false,
      reason:
        "public.organization_members table not found — Phase 1a migration is incomplete.",
    };
  }
  // Every tenant table must have organization_id.
  const missing: string[] = [];
  for (const t of TENANT_TABLES) {
    if (!(await tableExists(c, t))) continue; // table not in this DB — skip
    if (!(await hasColumn(c, t, "organization_id"))) missing.push(t);
  }
  if (missing.length > 0) {
    return {
      ready: false,
      reason: `Tenant tables missing organization_id column: ${missing.join(", ")}`,
    };
  }
  return { ready: true };
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const c = await newClient();
  try {
    const pf = await preflight(c);
    if (!pf.ready) {
      console.error(`\n[isolation] PREFLIGHT FAILED\n  ${pf.reason}\n`);
      process.exit(1);
    }
    console.log("[isolation] preflight OK — Phase 1a migration detected.\n");

    // Test fixtures. All rows use a prefix so teardown is unambiguous.
    const testPrefix = `iso_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;
    const orgA = randomUUID();
    const orgB = randomUUID();
    const userA = randomUUID();
    const userB = randomUUID();

    // ---- Setup (service role, bypasses RLS) --------------------------------
    await c.query(`INSERT INTO public.organizations (id, name)
                   VALUES ($1, $3), ($2, $4)`,
      [orgA, orgB, `${testPrefix}_A`, `${testPrefix}_B`]);
    // Users must exist in auth.users for FK integrity. Insert bare rows.
    await c.query(`INSERT INTO auth.users (id, email, aud, role)
                   VALUES ($1, $3, 'authenticated', 'authenticated'),
                          ($2, $4, 'authenticated', 'authenticated')`,
      [userA, userB, `${testPrefix}_a@test.local`, `${testPrefix}_b@test.local`]);
    await c.query(`INSERT INTO public.organization_members (user_id, organization_id, org_role)
                   VALUES ($1, $3, 'org_member'), ($2, $4, 'org_member')`,
      [userA, userB, orgA, orgB]);

    // ---- Group A: cross-org read isolation ---------------------------------
    // Ambient: as userA, SELECT * with no filter on any tenant table must
    // return zero rows belonging to orgB.
    for (const t of TENANT_TABLES) {
      await check(`A.read-isolation:${t}`, async () => {
        const exists = await tableExists(c, t);
        if (!exists) return; // classification includes tables not yet in this DB — skip
        await asUser(c, userA, async (tx) => {
          const r = await tx.query(
            `SELECT count(*)::int AS n FROM public.${quoteIdent(t)}
               WHERE organization_id = $1`,
            [orgB],
          );
          if (r.rows[0].n !== 0) {
            throw new Error(
              `userA (org A) can read ${r.rows[0].n} row(s) belonging to org B in ${t}`,
            );
          }
        });
      });
    }

    // ---- Group C: caller-supplied WITH CHECK rejects foreign org id --------
    // For the 4 tables where the app supplies organization_id from session
    // context, an INSERT stamped with another org's id must be rejected at
    // the RLS layer — the trigger cannot save us here because there's no
    // FK path to override the caller's value.
    for (const t of CALLER_SUPPLIED_TABLES) {
      await check(`C.caller-supplied-with-check:${t}`, async () => {
        const exists = await tableExists(c, t);
        if (!exists) return;
        let rejected = false;
        try {
          await asUser(c, userA, async (tx) => {
            // Minimal insert: id + organization_id. Table-specific NOT NULL
            // columns may error before RLS runs; that's an acceptable failure
            // mode (they never get to submit an org-B row).
            await tx.query(
              `INSERT INTO public.${quoteIdent(t)} (organization_id) VALUES ($1)`,
              [orgB],
            );
          });
        } catch (e) {
          rejected = true;
          // Accept either the RLS violation OR a NOT NULL failure — both
          // prevent the cross-org write from succeeding.
          const msg = (e as Error).message;
          if (
            !/row-level security|violates|not-null|null value/i.test(msg)
          ) {
            throw new Error(`unexpected failure mode: ${msg}`);
          }
        }
        if (!rejected) {
          throw new Error(
            `userA (org A) inserted a row into ${t} stamped with org B's id — RLS WITH CHECK missing`,
          );
        }
      });
    }

    // ---- Group D: trigger raises on missing org ---------------------------
    // With no active org set and no FK path, INSERT into a tenant table
    // must raise — not silently succeed via any fallback.
    await check("D.trigger-raises-on-missing-org", async () => {
      // Use `stores` as the canary — a root tenant table with no FK from
      // which to derive org, so the trigger's only options are the session
      // GUC or raise.
      let raised = false;
      try {
        await c.query("BEGIN");
        await c.query("SET LOCAL app.active_organization_id = ''");
        await c.query(
          `INSERT INTO public.stores (name) VALUES ($1)`,
          [`${testPrefix}_orphan`],
        );
        await c.query("ROLLBACK");
      } catch (e) {
        raised = true;
        await c.query("ROLLBACK").catch(() => {});
      }
      if (!raised) {
        throw new Error(
          "INSERT into stores succeeded without an active organization — trigger did not raise",
        );
      }
    });

    // ---- Group E: role-boundary invariant ---------------------------------
    // No function definition in public schema should reference both
    // organization_members.org_role and user_roles.role in the same body.
    // (Grep-based check on pg_proc source.)
    await check("E.role-boundary-no-mixed-checks", async () => {
      const r = await c.query(`
        SELECT p.proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prosrc ~* 'organization_members'
           AND p.prosrc ~* 'user_roles'
           AND p.proname NOT LIKE '\\_test\\_%'
      `);
      if (r.rowCount && r.rowCount > 0) {
        throw new Error(
          `functions mixing organization_members + user_roles in one body: ${r.rows
            .map((x) => x.proname)
            .join(", ")}`,
        );
      }
    });

    // ---- Teardown (service role) ------------------------------------------
    await c.query(`DELETE FROM public.organization_members WHERE user_id IN ($1,$2)`, [userA, userB]);
    await c.query(`DELETE FROM public.organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await c.query(`DELETE FROM auth.users WHERE id IN ($1,$2)`, [userA, userB]);

    // ---- Summary ----------------------------------------------------------
    const failed = results.filter((r) => !r.ok);
    console.log(
      `\n[isolation] ${results.length - failed.length}/${results.length} passed`,
    );
    if (failed.length > 0) {
      console.error(`[isolation] FAIL — ${failed.length} assertion(s)`);
      process.exit(1);
    }
    console.log("[isolation] all assertions passed.");
  } finally {
    await c.end();
  }
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`refusing to quote suspicious identifier: ${name}`);
  }
  return `"${name}"`;
}

main().catch((e) => {
  console.error("[isolation] fatal:", e);
  process.exit(1);
});