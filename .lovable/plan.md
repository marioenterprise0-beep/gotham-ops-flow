This is a large, cross-cutting governance change. Below is the proposed plan, broken into shippable sections. Please confirm or flag changes before I start.

## Section 1 — Alert filtering by role

- Add an `audience` concept on `alerts` (owner | manager | employee). Map every existing alert `type` to one audience via a `CASE` in a SQL view/function — no schema break.
- Rewrite the `alerts read scoped` RLS so:
  - Owners see owner+manager+employee.
  - Managers see manager+employee (+ those assigned to them).
  - Employees see only employee-tier alerts (schedule published, training assigned, clock issues, count assigned, shift notes, announcements, request decisions, order updates) AND only those scoped to them (assigned_user_id = uid OR created_by = uid OR trailer match + assigned_role='all').
- Update `useUnreadAlerts` and `/alerts` page to drop the previously-hidden counts and only render what RLS returns.
- Add new alert types where missing: `time_adjustment_decision`, `inventory_order_status`, `location_request`, `permission_change`, `system`.

## Section 2 — Inventory lockdown (owner-only structure)

- Tighten `inventory_items` RLS: writes (INSERT/UPDATE/DELETE) restricted to owner via `has_role(uid,'owner')`. Read remains scoped.
- Server fns: change `assertManager` → `assertOwner` for `upsertInventoryItem`, `updateOrderGuide`, `deleteInventoryItem`.
- Add `inventory_change_requests` table (manager/employee proposes add/edit/delete/archive → owner alert → on approve, server fn applies via admin client and writes audit_log + change_log).
- Add `archived_at` column to `inventory_items` (soft archive instead of hard delete by default).
- Keep crew-legitimate quantity flows (`receiveStock`, `logWaste`, `submitCount`) unchanged — those are operational, not structural.

## Section 3 — Inventory Guide (read-only employee resource)

- Add columns to `inventory_items`: `image_url`, `count_instructions`, `storage_location`. (Existing `par_level`, `unit`, `category`, `name` reused.)
- New route `/inventory-guide` visible to all authenticated users — card grid grouped by category with image, unit, PAR, count instructions, storage.
- Owner edits guide fields from existing inventory page (locked to owner).

## Section 4 — Location lockdown + temp-access codes

- Remove any trailer/location switcher from the AppShell for non-owners. Employees: hard locked to `profile.trailer_id`. Managers: switcher opens "Request Temporary Access?" dialog.
- New table `location_access_requests` (manager_id, current_trailer, requested_trailer, reason, duration_minutes, status, code_hash, code_expires_at, approved_by, used_at).
- Manager submits request → owner alert (in-app + email via existing dispatch hook).
- Owner approves → server fn generates 6-digit code, stores hash + 30-min expiry, emails owner the code via a new transactional template `location-access-code`.
- Manager enters code → server fn verifies hash, marks single-use, sets a short-lived session row `active_location_grants(manager_id, trailer_id, expires_at)` that `current_user_trailer()` honors.
- Update `current_user_trailer()` security-definer to return active grant if present, else `profile.trailer_id`.

## Section 5 — SOP lockdown

- Tighten RLS on `sop_versions`, `sop_attachments` to owner-only writes. Managers/employees read.
- Server fns: SOP create/update/delete/publish/archive require owner.
- Tracking already exists for assigned/completed; add `sop_views(user_id, sop_id, viewed_at)` and `sop_acknowledgements(user_id, sop_id, version, acked_at)`. Show owner a roll-up.

## Section 6 — Inventory orders

- Confirm crew can create orders (already allowed). Tighten: only owner can `approve`/`decline`; managers lose approval rights. Update `inventory-orders.functions.ts` accordingly and re-point the `inventory_order` alert to `assigned_role='owner'` (already is).
- Employees see `inventory_order_status` employee-tier alert when their order is approved/declined/received.

## Section 7 — Final access matrix + QA

After migrations + code land, I'll run through:
- Employee account: no trailer switcher; alerts list excludes owner/manager items; inventory page is view+count only; inventory guide visible; can create order; cannot edit SOP.
- Manager account: trailer switch prompts request flow; cannot edit inventory structure or SOP; sees manager+employee alerts only.
- Owner account: sees all alerts; only one able to approve inventory changes, location requests, SOPs.

## Technical notes

- All RLS uses existing `has_role` / `is_manager` security-definer functions (no recursion).
- `current_user_trailer()` change is the highest-risk piece because many policies depend on it — I'll keep the fallback behavior identical when no grant row exists.
- New tables (`inventory_change_requests`, `location_access_requests`, `active_location_grants`, `sop_views`, `sop_acknowledgements`) each ship with GRANTs + RLS + policies in the same migration.
- Email templates added to the existing registry; dispatch via existing queue worker.
- This will be delivered as 3 migrations + ~15 file edits. Roughly a large change — expect a few iterations.

## Open questions before I build

1. For **location temp access**, do you want the manager to **request a specific trailer** (dropdown of all trailers) or just "any other location"?
2. For **inventory change approval**, should an approved "edit" request apply the change atomically on approval, or open a draft the owner finalizes?
3. For **Inventory Guide images**, do you want me to add upload UI now (uses existing `gotham-photos` bucket) or leave `image_url` as a text field for later?
4. Anything I should NOT touch in this pass (e.g., keep current cash/recap behavior as-is)?