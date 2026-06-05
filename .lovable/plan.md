## Goal
Turn Gotham OS from in-memory prototype into a persistent multi-user operations platform.

## Step 1 — Enable Lovable Cloud + Auth
- Enable Cloud integration.
- Auth: email/password + Google sign-in. Login screen at `/auth`.
- `profiles` table (display name, role, store) auto-created on signup via trigger.
- `user_roles` table with enum `app_role` (`owner`, `manager`, `shift_lead`, `grill`, `prep`, `cashier`) + `has_role()` security-definer fn.
- Owner/Manager roles assigned manually (or via PIN-protected self-promote flow kept as fallback).
- Replace `src/lib/role.tsx` localStorage role with role pulled from `user_roles`.

## Step 2 — Schema
Tables (all RLS-enabled, GRANTed to authenticated + service_role):
- `stores` (id, name, location)
- `shifts` (id, store_id, date, phase, opened_by, opened_at, closed_by, closed_at, status)
- `tasks` (id, shift_id, phase, title, assignee_role, owner_id, status, photo_url, value, signed_off_by, signed_off_at, created_at)
- `inventory_items` (id, store_id, name, category, unit, par_level, low_threshold)
- `inventory_counts` (id, item_id, shift_id, count, counted_by, counted_at, variance)
- `inventory_receipts` (id, item_id, qty, received_by, received_at, supplier, notes)
- `waste_log` (id, item_id, qty, reason, logged_by, logged_at, photo_url)
- `sops` (id, title, category, role, body, pass_standard, version)
- `hospitality_incidents` (id, shift_id, type, severity, notes, recovery_action, logged_by, logged_at)
- `audit_log` (id, actor_id, action, entity, entity_id, payload, created_at)

Every mutation server-fn writes an `audit_log` row.

## Step 3 — Server functions
`src/lib/*.functions.ts` modules using `requireSupabaseAuth`:
- `shifts.functions.ts`: openShift, closeShift, getActiveShift
- `tasks.functions.ts`: listTasks, completeTask (photo upload), signOffTask (manager only)
- `inventory.functions.ts`: listInventory, submitCount, receiveStock, logWaste
- `hospitality.functions.ts`: logIncident, listIncidents
- `manager.functions.ts`: listPendingApprovals, approveTask, getKpis

Storage bucket `gotham-photos` (private) for task photos + waste evidence.

## Step 4 — UI wiring
- Rewrite `/operations`, `/inventory`, `/hospitality`, `/manager`, `/analytics`, `/index` to use TanStack Query + server fns (mutations invalidate queries).
- Operations: photo capture upload to bucket, sign-off requires manager role.
- Inventory: receiving modal + waste modal persist to DB; variance computed live.
- Manager Panel: approvals queue (pending sign-offs), crew performance (% on-time tasks), store rankings (real aggregations).
- Analytics: recharts fed by aggregated queries (compliance trend, waste $, ticket speed).

## Step 5 — Audit
Helper `writeAudit()` called from every mutation. Manager-only `/manager/audit` route shows latest 100 entries.

## Out of scope (this round)
- Real-time ticket timer integrations
- SMS / push notifications
- Multi-store switching UI (single default store seeded)

This is a substantial build (~15 new files, 10 edits, 1 migration). Approve and I'll execute end to end.