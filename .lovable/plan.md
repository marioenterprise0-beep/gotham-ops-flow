# Phase 13 — Archive & Integrity Admin Suite

Wires the Phase 4–12 archive infrastructure into actual admin surfaces, plus tooling to keep the system clean over time.

## 1. Archive Center UI

New route: `/admin/archive` (owner/manager gated under `_authenticated`).

- **Domain tabs**: SOPs, Task Templates, Schedules, Inventory Items, Inventory Orders, Alerts, Schedule Shifts, Shift Notes, Inventory Counts, Trailers, Stores, Location Requests.
- **Per-row actions**: Restore, View Dependencies, Hard Delete (owner-only).
- **Dependency drawer**: calls each domain's `scan*Dependencies` and shows live child counts before allowing delete.
- **Filters**: archived date range, archived-by user, reason text search.
- Reuses existing `*-archive.functions.ts` modules — no new server logic for the basic flows.

## 2. Bulk Purge Jobs

- New server fn `purgeArchivedOlderThan({ domain, days })` — owner-only, dispatches per-domain hard-delete with `force:false` (skips rows that still have live dependencies, reports counts).
- New scheduled route `src/routes/api/public/hooks/archive-purge.ts` — nightly cron, purges archived rows older than 90 days across all domains.
- Per-domain override stored in `automation_settings` (`archive_retention_days` jsonb).
- UI: "Purge Now" button in Archive Center header (owner-only) with confirmation.

## 3. Audit Log Viewer

New route: `/admin/audit-log` (owner-only).

- Reads from existing `audit_log` table.
- Filters: actor, entity type, action (archive/restore/delete/etc.), date range.
- Side panel shows full `payload` JSON pretty-printed.
- Paginated (50/page), newest first.
- Export to CSV.

## 4. Dependency Health Dashboard

New route: `/admin/data-health` (owner/manager).

- New server fn `runAllDependencyScans()` — fans out every `scan*Dependencies` across archived rows and reports anything still blocked (cannot be hard-deleted because live children exist).
- Health cards per domain: total archived, purgeable, blocked, oldest archived row.
- Drill-in lists blocked rows with the specific dependency type/count.
- Manual "Run Scan" button + cached result (5-minute TTL in TanStack Query).

## Technical Details

- **New files**:
  - `src/routes/_authenticated/admin.archive.tsx`
  - `src/routes/_authenticated/admin.audit-log.tsx`
  - `src/routes/_authenticated/admin.data-health.tsx`
  - `src/lib/archive-center.functions.ts` (unified `listArchived(domain)` + `purgeArchivedOlderThan`)
  - `src/lib/data-health.functions.ts` (`runAllDependencyScans`)
  - `src/lib/audit-log.functions.ts` (`listAuditLog`, `exportAuditLogCsv`)
  - `src/routes/api/public/hooks/archive-purge.ts` (cron hook)
  - `src/components/admin/ArchiveTable.tsx`, `DependencyDrawer.tsx`, `HealthCard.tsx`
- **Migration**: add `archive_retention_days jsonb default '{}'` column to `automation_settings`; schedule pg_cron for nightly purge.
- **No new tables** — all infrastructure already exists from Phases 4–12.
- **Navigation**: add "Admin" submenu entries gated by `is_manager`/owner.

## Out of scope

- Restoring across domain boundaries (e.g. restoring a trailer that references an archived store) — surfaced as a warning, not auto-resolved.
- Modifying append-only logs (`audit_log`, `change_log`, `email_send_log`) — viewer only.
