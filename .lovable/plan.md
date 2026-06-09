# Canonical Sync Rollout — Phases 4–10

Same pattern as Inventory / Users / SOPs:
1. Add `archived_at`, `archived_by`, `archive_reason` to canonical table.
2. `list*` filters archived by default + `includeArchived` (owner-only).
3. `scan*Dependencies` checks all FK-referencing tables.
4. `archive*` / `restore*` soft toggle; `delete*` blocks on deps unless `force` (Super Admin).
5. Update every dependent reader (dashboard/health/analytics/etc.) to filter archived.
6. Add domain to `sync-bus.ts` fan-out with all related cache keys.
7. UI: Show Archived toggle, dependency-aware remove flow, Archived badge, Restore button.
8. Audit log entry on every mutation.

## Grouping (one phase = one migration + one PR-sized batch)

**Phase 4 — Schedules domain**
- `schedules`, `schedule_shifts`, `shift_templates`
- Dependents: time_punches, labor reports, dashboard, manager view

**Phase 5 — Time & Labor**
- `time_punches`, `time_corrections`, `time_off_requests`
- Weekly Hours / Labor are derived views — update readers only, no archive column
- Dependents: payroll rollup, labor.functions, dashboard, manager

**Phase 6 — Cash domain**
- `cash_drawers`, `cash_drawer_sessions`, `cash_drops`
- Dependents: dashboard cash widgets, reports, alerts

**Phase 7 — Operations**
- `daily_recaps`, `shifts`, `shift_notes`, `tasks`, `task_templates`, `checklist_sessions`, `hospitality_incidents`, `waste_log`
- Dependents: dashboard, performance, history

**Phase 8 — Inventory Orders / Order Guide**
- `inventory_orders`, `inventory_order_items`, `inventory_receipts`, `inventory_change_requests`
- Order Guide is a derived view from inventory_items — readers only
- Dependents: alerts, dashboard

**Phase 9 — Locations & Access**
- `trailers`, `stores`, `active_location_grants`, `location_access_requests`, `tab_permissions`, `invite_codes`
- Dependents: nearly every module (trailer_id is ubiquitous)

**Phase 10 — Communication / Derived**
- `alerts`, `alert_actions`, `notification_preferences`, `email_send_log`
- Announcements, Knowledge Hub, Performance, Reports, Dashboards, History, Training, Notifications, Emails — these are **derived views**, not canonical tables. They get reader-filter + fan-out updates only.

## Per-phase deliverables
- 1 migration (archive columns + indexes for canonical tables only)
- Updates to `src/lib/<domain>.functions.ts` (scan/archive/restore/delete)
- Reader updates in dependent `*.functions.ts`
- `sync-bus.ts` fan-out additions
- UI updates on the primary route(s)
- Verify build passes between phases

## Scope clarifications I need before starting

1. **Pace**: Should I ship all 7 phases in this single turn (very long — 7 migrations, ~40 file edits, multiple build waits), or one phase per turn so you can review each?
2. **Derived modules** (Weekly Hours, Labor, Performance, Reports, Dashboards, History, Training, Announcements, Knowledge Hub, Notifications, Emails) have no canonical table of their own — confirm "reader-filter + fan-out only" is acceptable rather than inventing new tables.
3. **Locations (trailers)**: archiving a trailer cascades to virtually everything. Confirm you want full archive support (vs. just `active=false` which already exists).
4. **Alerts**: already have `status='archived'`. Should I add the formal `archived_at` columns too, or treat the existing status as the archive mechanism?
