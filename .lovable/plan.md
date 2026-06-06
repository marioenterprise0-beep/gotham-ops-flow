## Alerts Module + Inventory Orders

This is a large build. I'll structure it in phases so we can ship a working core first, then layer integrations. Confirm the plan (or trim/reorder) and I'll execute.

### Phase 1 — Database (one migration)

New tables (all RLS-enabled, scoped by role + trailer):

- `inventory_orders` — id, trailer_id, created_by, status (enum: draft/submitted/pending_owner_review/approved/declined/changes_requested/ordered/received/cancelled), submitted_at, decided_by, decided_at, owner_comment, notes
- `inventory_order_items` — order_id, item_id, current_qty, par_qty, requested_qty, urgency (normal/needed_soon/critical/emergency), reason, notes
- `alerts` — id, type (enum: missed_clock_out, missed_clock_in, time_adjustment, time_off, inventory_order, low_stock, critical_stock, checklist_failure, manager_note, schedule_approval, maintenance), title, source_module, source_id (uuid of underlying record), trailer_id, created_by, assigned_role (manager/owner), priority (critical/high/normal/low), status (open/pending/approved/declined/resolved), resolution, resolved_by, resolved_at, payload jsonb
- `alert_actions` — alert_id, actor_id, action (comment/approve/decline/request_changes/mark_ordered/mark_received/escalate/resolve), note, created_at

RLS:
- Managers: read alerts where assigned_role='manager' OR trailer matches; insert orders & alerts; cannot approve own.
- Owners: full read/write on alerts and orders.
- Triggers: inserting an inventory_order with status='submitted' auto-creates an owner alert. Same pattern for time_corrections, time_off_requests, schedules submitted.

### Phase 2 — Server functions (`src/lib/alerts.functions.ts`, `src/lib/inventory-orders.functions.ts`)

- `listAlerts({ role, status?, type?, trailer? })`
- `actOnAlert({ alertId, action, note? })` — owner approve/decline/etc., updates source record (e.g. order status, time_correction status)
- `createInventoryOrder({ trailer_id, items[], notes })`
- `listInventoryOrders({ scope: 'mine'|'all', status? })`
- `getInventoryOrder({ id })`
- `decideInventoryOrder({ id, decision, comment })` — owner only

Existing flows (time_corrections, time_off_requests, schedules) get a small adapter so submissions emit alerts via the trigger.

### Phase 3 — UI

New route `src/routes/_authenticated/alerts.tsx`:
- Top stat cards: Open / Critical / Pending Approval / Resolved Today
- Filter chips: All | Inventory | Labor | Scheduling | Operations | Maintenance | Hospitality
- Status tabs: Open / Pending / Approved / Declined / Resolved
- Alert cards with priority color (red/orange/blue/gray), Type, Title, Location, Submitted By, Time, Action buttons
- Detail drawer: full payload + action history + comment box + role-appropriate actions

Inventory tab additions (`src/routes/inventory.tsx` or new subroute):
- "Create Inventory Order" button (managers+)
- Order builder modal: trailer, multi-row item picker (item, current auto-filled, par auto-filled, requested, urgency, reason, notes), submit
- "My Orders" history table with status + owner comments

Manager dashboard: small "Alerts" badge with open count.

Nav: add `Alerts` link to AppShell (visible to manager + owner).

### Phase 4 — Wire integrations
- Missed clock in/out → scheduled check (server fn called on time-clock load) creates alerts
- Low/critical stock → computed from inventory_items vs low_threshold, alert auto-created
- Checklist failure → on task with `requires_signoff` failed, alert
- Owner decisions flow back into the source table (time_corrections.status, schedules.status, inventory_orders.status)

### Technical notes
- All enums as Postgres types; all tables get GRANTs to authenticated + service_role.
- Use `has_role`/`is_manager` for RLS; owners use `has_role(auth.uid(),'owner')`.
- Realtime enabled on `alerts` so the badge live-updates.
- Permission rule enforced server-side: `decideInventoryOrder` rejects if `created_by = auth.uid()`.

### Scope check before I start
This is roughly 1 migration + 4 new files + 3 edits + 1 new route. Want me to:
**(a)** Build it all in one pass, or
**(b)** Ship Phase 1+2+Alerts UI first, then Inventory Order builder + integrations in a follow-up?