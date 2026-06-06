# Multi-Trailer + Editable SOPs + Personal Tasks + Per-Location Analytics

## 1. Trailers (Greece + Henrietta) — strict per-trailer scoping

**DB**
- Seed two trailers: `Greece` and `Henrietta` (if not already present).
- Add `trailer_id` (uuid, nullable→backfilled→not null) to: `inventory_items`, `shifts`, `tasks`, `hospitality_incidents`, `waste_log`, `inventory_counts`. (`schedules` and `schedule_shifts` already have it; `profiles` already has it.)
- Helper SQL function `public.user_trailer_id()` returns `profiles.trailer_id` for `auth.uid()`.
- Helper `public.is_owner_or_manager()` already exists as `is_manager`.
- Tighten RLS on the above tables: crew can only `SELECT/INSERT` rows where `trailer_id = user_trailer_id()`. Owners/managers can read all trailers.

**App**
- New `TrailerContext` reads the user's trailer + (for managers/owners) exposes a switcher with `Greece / Henrietta / Company`.
- All server fns (`listInventory`, `getActiveShift`, `listTasks`, dashboard, analytics) take an optional `trailerId` param; default = user's own trailer; managers can pass either or `null` (= company).

## 2. SOPs — fully editable

- New `sop_attachments` table (sop_id, file path in `gotham-photos` bucket, uploaded_by, label).
- New `sop_versions` table (sop_id, version, title, body, category, role, edited_by, edited_at) — written on every update.
- `body` stays text but rendered with a lightweight markdown renderer (bold/headers/lists) so users get rich text without adding a heavy editor dependency.
- SOPs route: inline edit each card (title, category, role dropdown, markdown body, pass standard), "Attach photo" upload, "History" drawer showing versions with diff-friendly view + restore button.

## 3. Tasks — assign to a specific employee

- Add `assignee_user_id uuid` to `tasks` (already has `owner_id` and `assignee_role`; we'll use `assignee_user_id` as the explicit personal assignment).
- Manager/owner UI in Operations: when creating a task, can pick an employee from the trailer's roster (or leave blank for role-based / general).
- New `/my-tasks` route: shows all tasks across active shifts where `assignee_user_id = auth.uid()` OR (`assignee_role = my role` AND no specific assignee).
- Nav: add **My Tasks** tab visible to all logged-in users.

## 4. Analytics — Greece / Henrietta / Company tabs

- Top of `/analytics`: 3-tab segmented control. Selection drives a `trailerId` query param passed to every chart's data fn.
- Server fn `getAnalytics({ trailerId | null, range })` returns KPIs + chart series filtered by trailer (`null` = company, both trailers combined).
- Company view also shows a small "Greece vs Henrietta" comparison row at the top.

## 5. Inventory — per location

- `inventory_items` becomes trailer-scoped. Same `/inventory` route, but the active list and counts are filtered to current trailer; managers see a trailer toggle.

---

## Out of scope this pass
- Drag/resize on schedule grid.
- File-attachment versioning history (we store attachments but they live across versions).
- Custom roles per trailer.

## Files touched (high level)
- **DB migration** (single) — trailers seed, new columns, RLS rewrite, sop_versions/sop_attachments, has-trailer helpers.
- `src/lib/role.tsx` — add `useTrailer()` + scope switcher state.
- `src/lib/sops.functions.ts` — versions, attachments, history.
- `src/lib/tasks.functions.ts` + `src/lib/manager.functions.ts` — `assignee_user_id`, trailer scoping.
- `src/lib/inventory.functions.ts` — trailer filter.
- `src/lib/dashboard.functions.ts` (new `analytics.functions.ts`) — trailer-scoped KPIs.
- `src/components/gotham/AppShell.tsx` — trailer switcher in header, add **My Tasks** nav.
- `src/routes/sops.tsx` — inline editor + attachments + history drawer.
- `src/routes/operations.tsx` — employee picker.
- `src/routes/inventory.tsx`, `src/routes/analytics.tsx` — trailer tabs/filter.
- `src/routes/my-tasks.tsx` (new) — personal task list.

Approve and I'll build it in one pass.
