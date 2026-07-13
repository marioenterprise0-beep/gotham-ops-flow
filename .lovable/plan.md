# Phase 1a — Execution Protocol v3 (final)

Multi-tenancy foundation for Cibora Systems. Runbook only — v3 feature plan governs *what* Phase 1a builds.

## Staging model

- You provision `cibora-staging` in the same workspace and load a fresh prod export via Cloud → Advanced settings → Export data.
- Staging holds real employee PII from load until wipe. Access restricted to you and platform.
- After Gate E, staging is wiped or the project deleted.

## Maintenance window (Step 6)

Step 6 runs inside a scheduled low-traffic maintenance window you announce to operators. Target: an overnight slot when no trailer is open and no cron job is due. Expected duration 20–40 min.

Writes arriving during the window are covered by:

1. **App-level maintenance mode** (shipped in deploy D1). Non-super-admin users see a full-screen offline page. Timeclock endpoints stay live; punches accepted and stamped by the trigger below.
2. **DB-level `BEFORE INSERT` org-fill trigger** (installed in migration 1). Fills `organization_id` from, in order: caller-supplied value → FK to `trailer_id`/`store_id`/`employee_id`'s owning org → `current_setting('app.active_organization_id', true)` → the seed org (`Dip N Shake`) as last-resort fallback, logged to `change_log`.

**The Dip N Shake fallback exists only for Phase 1a.** See exit criterion in Phase 1b section.

## Step 6 ordered sequence

Each numbered item is a separate approval inside the window:

1. **Migration 1** — create `organizations`, `organization_members`, `organization_invites`, `brands`; helper fns (`is_member_of_org`, `is_manager_of_org`, `current_user_org_ids`); install `BEFORE INSERT` org-fill trigger on every tenant table.
2. **Migration 2** — add nullable `organization_id` + FK to every tenant table **and add nullable `profiles.active_organization_id` column + FK** (no trigger yet; D1 needs the column to exist).
3. **Migration 3** — seed `Dip N Shake` org, membership rows for existing users, backfill `organization_id` on every tenant row, backfill `profiles.active_organization_id` to Dip N Shake for existing users.
4. **Migration 4** — flip `organization_id` to `NOT NULL` on every tenant table (and on `profiles.active_organization_id`).
5. **App-code deploy D1** — release that reads `active_organization_id` from `profiles`, sets `app.active_organization_id` per request, ships maintenance mode, uses `current_user_org_ids()` fetchers. Runs against a DB where the column exists and is populated.
6. **Migration 5** — rewrite RLS policies to authorize via `organization_members`.
7. **Migration 6** — Storage buckets to org-scoped paths + Storage RLS.
8. **Migration 7** — scope Realtime channels + cron jobs + push-token tables to org.
9. **Migration 8** — install sign-in trigger that sets `profiles.active_organization_id` on first membership when null (column itself already exists from migration 2).
10. **App-code deploy D2** — lift maintenance mode; enable org-switcher UI.

Failure at any step halts the sequence. In-window writes are covered by the trigger; Gate D's fresh export is the rollback artifact.

## Gates (unchanged from v2 except Gate D wording)

- **Gate A** — you confirm `cibora-staging` exists and app boots against it.
- **Gate B** — you approve Baseline Parity Report v1.
- **Gate C** — you approve Staging Verification Bundle (Parity Report v2, backfill audit, trigger-fallback-fired = 0 on clean staging, isolation suite green, smoke test).
- **Gate D** — before entering the maintenance window, you post in chat: fresh prod export completed at [timestamp], **archive opened and verified to contain a file/dump entry for every table** (68 at last count, checksum or file-count summary acceptable). I explicitly acknowledge receipt before the window starts. Verification failure → re-export and re-verify.
- **Gate E** — you confirm production healthy after Production Verification Bundle.
- **Post-execution** — you wipe or delete `cibora-staging` and confirm in chat.

## Phase 1b exit criteria (binding, promoted from note)

Phase 1b (`trailer` → `location` terminology + fallback removal) does not ship until:

1. **The Dip N Shake fallback branch is removed from the `BEFORE INSERT` org-fill trigger on every tenant table.** Migration recreates each trigger without the seed-org fallback; trigger continues to fill from caller value / FK / `app.active_organization_id` only, and raises on failure.
2. **Isolation suite gains a blocking assertion** (`pnpm test:isolation`) that inspects each tenant table's trigger definition and fails if any branch references the Dip N Shake org id or any hardcoded organization id. CI red = deploy blocked.
3. **Isolation suite gains a runtime assertion**: with `app.active_organization_id` unset and no FK path, an insert into every tenant table must raise, not silently succeed.
4. **`change_log` fallback-fired count over the Phase 1a soak window must be 0** before Phase 1b runs. Any non-zero count is investigated and root-caused before proceeding.

No second organization may be created — via admin console, invite flow, or seed — while the fallback trigger exists. The org-creation server function will refuse when it detects the fallback branch still installed. This is a code-level guard, not a policy.

## What ships in Phase 1a (unchanged from v3 feature plan)

Org tables + membership + invites + brands · `organization_id NOT NULL` on every tenant table · `profiles.active_organization_id NOT NULL` · RLS rewritten against `organization_members` · Storage/Realtime/cron/push scoped to org · Dip N Shake seeded, existing users backfilled · `pnpm test:isolation` in CI · sign-in trigger · maintenance mode · org-fill trigger with Dip-N-Shake fallback (removed in 1b) · org-creation guard that refuses while fallback exists.

## What I need from you to start

1. Confirm v3 protocol.
2. Create `cibora-staging` + load a fresh prod export.
3. Post the staging project handle and the target maintenance window date/time in chat.

I'll begin Step 2 after Gate A.
