# Phase 1a — Execution Protocol v4 (Option 3, pre-launch scaffold)

Multi-tenancy foundation for Cibora Systems. This project is the SaaS scaffold — separate from any live operating brand. Prod holds 7 rows, no live operators. That premise governs the whole runbook.

## Governing decisions

- **No staging project.** With 7 rows, staging parity is ceremony. Ship straight to this project inside a short window.
- **No maintenance mode.** No live traffic to protect.
- **No Dip-N-Shake fallback trigger.** Ever. The `BEFORE INSERT` org-fill trigger fills from caller value → FK path → `current_setting('app.active_organization_id', true)` and **raises `insufficient_privilege` on failure.** Phase 1b's "remove the fallback" exit criterion is void by construction.
- **Isolation suite is CI-blocking from day one.** `npm run test:isolation` runs in GitHub Actions on every PR. Red = merge blocked.
- **Gate D is retained.** You take a pre-migration export and verify the archive opens with all 69 tables. Then post confirmation. I acknowledge. Migration runs.
- **Gate E is retained.** Post-migration verification: isolation suite green, all 7 backfilled rows correctly stamped, RLS smoke test as super-admin and as regular user.
- **Seed org: "Cibora Dev".**

## Table classification (signed off)

- **GLOBAL, no org column (7):** cron_dispatch_config, email_dispatch_config, email_send_state, suppressed_emails, email_unsubscribe_tokens, weekly_rollup_runs, plus `email_send_log` which gets a **nullable** `organization_id` for attribution (service-role access only, no RLS exposure).
- **USER-OWNED (2):** `profiles` (RLS by user_id; nullable `active_organization_id` convenience pointer), `notification_preferences` (per-user global; org-override is documented future upgrade path).
- **TENANT, `organization_id NOT NULL` (60):** every other public table. See detailed classification in chat history — 32 direct-fill, 2 root tenant (stores/trailers), 8 org-owned resource, 15 FK-derived, 4 caller-supplied-from-session (alert_category_reads, audit_log, access_log, employee_pins).

## Role boundary (hard rule — no server fn checks both in one predicate)

| System                           | Enum                                                         | Purpose                                                 | Read by                                                                |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `organization_members.org_role`  | `org_owner`, `org_admin`, `org_member`                       | Org itself — billing, membership, org settings          | Org management flows only                                              |
| `user_roles` (per-user, per-org) | `owner`, `manager`, `shift_lead`, `grill`, `prep`, `cashier` | Operational feature access — schedules, cash, inventory | Every business-feature server fn via `has_role(user_id, org_id, role)` |

`is_org_admin(user_id, org_id)` reads `organization_members` only. `is_manager(user_id, org_id)` / `has_role(user_id, org_id, role)` read `user_roles` only. Grep-safe boundary.

## What ships in one migration batch

1. Org tables — `organizations`, `organization_members`, `organization_invites`, `brands` — with grants + RLS + policies.
2. New enum `org_role` (`org_owner`, `org_admin`, `org_member`).
3. Helper fns — `is_org_member(uid, org_id)`, `is_org_admin(uid, org_id)`, `current_user_org_ids(uid)`, `has_role(uid, org_id, role)` (replaces 2-arg version), `is_manager(uid, org_id)`.
4. `profiles.active_organization_id uuid` (nullable) + FK to `organizations`.
5. `organization_id uuid NOT NULL` + FK on all 60 tenant tables; nullable `organization_id` on `email_send_log`.
6. `BEFORE INSERT` org-fill trigger on all 60 tenant tables — no fallback, raises on failure.
7. RLS rewritten on every tenant table to authorize via `organization_members`. For the 4 caller-supplied tables (alert_category_reads, audit_log, access_log, employee_pins), RLS INSERT/UPDATE `WITH CHECK` verifies `organization_id = ANY(current_user_org_ids(auth.uid()))`.
8. Storage buckets → org-scoped path prefix + Storage RLS.
9. Realtime channels + cron jobs + push-token tables scoped to org.
10. Sign-in trigger — sets `profiles.active_organization_id` on first membership when null.
11. Seed `Cibora Dev` org + `organization_members` row for the existing user + backfill all 7 tenant rows.

## App-code changes (deployed after migration approved and types regenerate)

- Set `app.active_organization_id` per request from `profiles.active_organization_id`.
- Replace every fetcher's implicit-org logic with `current_user_org_ids(auth.uid())` filter.
- Org-switcher UI in the shell.
- Org-creation server fn (open — no fallback trigger to guard against).
- All `is_manager(uid)` / `has_role(uid, role)` call sites updated to pass org_id.

## Gates

- **Gate D** ✅ (confirmed) — pre-migration export taken and archive verified.
- **Gate E** — after migration + app deploy: isolation suite green, backfilled rows correct, RLS smoke test passes.

## Deferred technical debt

- **Group B full FK-chain seeds.** The isolation suite currently exercises cross-org UPDATE/DELETE rejection as a smoke test against 60 tenant tables (meaningful for the 3 seeded canary tables, trivially green for the rest). Full FK-chain seeds for every tenant table are deferred until real multi-org data exists — **revisit before Phase 2.5 beta.**

## Files

- `scripts/test-isolation.ts` — the isolation suite. Fails loudly with clear message before migration runs (organizations table missing = expected pre-migration state).
- `.github/workflows/ci.yml` — runs `npm run test:isolation` on every PR, blocking.
- Migration SQL draft: `.lovable/phase-1a-migration.sql` (draft file for review, then submitted via migration tool).
