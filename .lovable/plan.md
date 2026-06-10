## Scope

Six related changes across permissions, recap, schedules, SOPs, and inventory. Keep the prior owner-only lockdown for governance actions; restore only the operational items listed below.

---

## Section 1 — Manager Task Control (controlled restore)

**Backend (`src/lib/tasks.functions.ts`, new `manager-tasks.functions.ts`)**
- Add `createShiftTask` server fn: manager-only, requires `shift_id` + `trailer_id`, optional `assignee_user_id`/`assignee_role`, `due_at`, `title`, `description`, `requires_signoff`. Inserts into `tasks` (NOT `task_templates`) scoped to one shift.
- Add `duplicateTaskTemplate` (manager) → creates a `tasks` row from an existing template for a given shift. Does NOT write to `task_templates`.
- On insert, emit an `alerts` row (type `manager_note`, assigned to the role or user) so employees get notified.
- Keep `task_templates.functions.ts` write paths owner-only (already done).

**UI**
- `src/components/gotham/TaskTemplatesPanel.tsx` — for managers, hide Create/Edit/Delete/Archive template controls; show a read-only template list with a "Use as shift task" button that calls `duplicateTaskTemplate`.
- `src/routes/manager.tsx` — add "Create Shift Task" dialog (title, description, assignee, due, signoff) wired to `createShiftTask`. Show inside the Today's Crew / Shift Tasks panel.
- Owner UI for templates unchanged.

---

## Section 2 — Daily Recap for All Roles

**Backend (`src/lib/recaps.functions.ts`)**
- Replace the `isManager` gate in `saveRecap` with a role-aware gate: any authenticated user can save a recap for themselves; the row's `manager_id` becomes "author_id" semantically (column reused).
- Add a `kind` column to `daily_recaps` (`crew` | `manager`) via migration; default by caller role. Crew recap uses a small subset of fields (summary, issues, notes, inventory notes, customer notes, completed work) — store those in existing free-text columns (`ops_went_well` = completed work, `ops_attention` = issues, `next_shift_notes` = notes, `inv_concerns` = inventory notes, `hosp_feedback` = customer notes) plus add `crew_summary text` column.
- `listRecaps`: owners see all; managers see their location + crew at their location; crew see only their own. Add `kind`, `authorId`, `trailerId` filters.

**Migration**
- `ALTER TABLE public.daily_recaps ADD COLUMN kind text NOT NULL DEFAULT 'manager'`, `ADD COLUMN crew_summary text`.
- Update RLS so crew can `INSERT` their own recap and `SELECT` their own.

**UI**
- `src/routes/recaps.tsx` — render Crew form (compact) vs Manager form (full) based on effective role; Owner sees filter bar (employee, manager, location, date, kind) and the full list.
- Add Recaps entry to crew nav.

---

## Section 3 — Schedule Visibility for Crew

**Backend (`src/lib/schedule.functions.ts`)**
- Add `listMyScheduleShifts` (any auth user) returning only shifts where `employee_id = userId` from published schedules. Include shift date/time/role/trailer.
- Add `requestScheduleChange` (any auth user) → creates an alert / change request row visible to manager+owner.

**UI**
- `src/routes/schedule.tsx` — when effective role is crew, render a read-only "My Schedule" view (assigned shifts, upcoming, details) with a "Request Change" button. Hide edit/publish/approve and other-employee data.
- `src/routes/index.tsx` (dashboard) — show next 3 upcoming shifts for crew.

---

## Section 4 — Global SOP Propagation

**Backend (`src/lib/sops.functions.ts`)**
- Confirm SOP write fns are owner-only and have no `trailer_id` filter on the master record (SOPs are global).
- Ensure `publishSop` bumps version and that `listSops` for all roles returns the latest published version regardless of location.
- Keep `sop_acknowledgements` per-employee and per-trailer (location-scoped completion).

**UI**
- `src/routes/sops.tsx` — managers/crew get view-only; owner sees edit/publish/archive.

---

## Section 5 — Global Inventory Structure / Local Quantities

**Backend (`src/lib/inventory.functions.ts`)**
- Split writes:
  - Owner-only: create/edit/delete/archive `inventory_items` master fields (name, category, vendor, unit, par, low_threshold, minimum_qty, guide).
  - When owner creates a new master item, fan it out: insert one row per active trailer with `current_qty = 0` (or upsert a per-trailer quantity row). 
- Two viable models — pick model B to avoid a schema migration:
  - **Model B (chosen):** keep current `inventory_items` (per-trailer rows) but enforce that structural fields are identical across trailers by writing the same payload to every trailer when owner updates. Managers can only update `current_qty`, `last_counted_at`, notes.
- Add `propagateInventoryItem` helper used by owner mutations.
- Counts/orders/receiving remain location-scoped (already are).

**UI**
- `src/routes/inventory.tsx` — managers see count/recount/receive/order; structural edit fields disabled.
- `src/routes/order-guide.tsx` / inventory guide — owner-only edits.

---

## Section 6 — Validation

After implementation, manually verify in preview:
1. Owner creates SOP → visible on all trailers (switch location).
2. Owner edits inventory item → name/par/threshold update across trailers, counts unchanged.
3. Manager creates shift task → alert fires, employee sees it in My Tasks.
4. Crew submits recap → manager + owner see it in Recaps.
5. Crew opens /schedule → sees own shifts only, no editor.
6. Manager cannot reach owner-only template/inventory-structure mutations (server returns `Owner role required`).

---

## Technical Notes

- Effective role still comes from `src/lib/role.tsx` (`actAsRole` impersonation for owners).
- All server fns continue to enforce real role via `user_roles` table — impersonation is UI-only.
- Single migration adds `daily_recaps.kind` + `daily_recaps.crew_summary` and adjusts RLS for crew inserts.
- No changes to the global Active Location context; this work plugs into it.

---

## Files (planned)

- migration: `daily_recaps` columns + policies
- `src/lib/tasks.functions.ts` — add `createShiftTask`, `duplicateTaskTemplate`
- `src/lib/recaps.functions.ts` — role-aware save/list, `kind` support
- `src/lib/schedule.functions.ts` — `listMyScheduleShifts`, `requestScheduleChange`
- `src/lib/inventory.functions.ts` — owner-only structural writes + propagation; manager count-only
- `src/components/gotham/TaskTemplatesPanel.tsx` — role-gated UI
- `src/routes/manager.tsx` — Create Shift Task dialog
- `src/routes/recaps.tsx` — crew/manager/owner views
- `src/routes/schedule.tsx` — crew read-only view
- `src/routes/sops.tsx` — role-gated UI
- `src/routes/inventory.tsx` — structural-edit gating
- `src/routes/index.tsx` — crew upcoming shifts widget
