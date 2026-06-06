# Modules 9 + 10 — Change Log & Shift Handoff

Two new modules, shipped one phase at a time so you can sanity-check each before the next lands.

---

## Phase 1 — Module 9: Change Log (operational history)

**Goal:** Every meaningful edit across the app shows up in one searchable history with who / what / before / after / reason / time. No silent edits.

### Data
- New table `change_log` with: `actor_id`, `actor_name` (denorm for fast search), `entity` (e.g. `inventory_item`, `schedule`, `time_punch`, `inventory_order`, `alert`), `entity_id`, `action` (`update | unlock | adjust | approve | close | create | delete`), `before` jsonb, `after` jsonb, `reason` text, `trailer_id`, `created_at`.
- Owner + manager read. Inserts via server functions only (no direct client writes).
- We already have `audit_log` and `time_audit`. Change Log is the **user-facing** history: richer (before/after diff, reason required for sensitive actions), and unified across modules. Existing audit tables stay as low-level trails.

### Wiring (where edits get logged)
- **Inventory** — qty / par / cost edits in `inventory_items` and order approvals.
- **Schedule** — unlock, publish, shift edits.
- **Hours** — `time_corrections` decisions, manual punch edits.
- **Orders** — submit / approve / reject.
- **Alerts** — acknowledge / close (with resolution note).
- A small `logChange()` helper called from each existing server fn — no scattered triggers, no duplication.

### UI
- New route `/change-log` (Owner + Manager) with: search box, filters (entity, actor, date range), and a row per change showing actor · action · entity · diff summary · reason · timestamp. Click a row → drawer with full before/after JSON diff.
- Add **"Reason"** input to: schedule unlock, hours adjust, alert close, order approve/reject (already partly there). Reason is required on those flows going forward.
- Nav tab: "Change Log" (Owner/Manager), under Audit Log.

---

## Phase 2 — Module 10: Shift Handoff

**Goal:** Outgoing manager files a structured handoff; incoming manager must acknowledge before the baton passes. Nothing falls through the cracks.

### Data
- New table `shift_handoffs`: `trailer_id`, `outgoing_manager_id`, `incoming_manager_id` (nullable until acknowledged), `shift_date`, `outgoing_shift_segment` (am/pm/close), `status` (`draft | sent | read | accepted`), `sent_at`, `read_at`, `accepted_at`, plus sections:
  - `completed` text, `incomplete` text, `inventory_issues` text, `employee_notes` text, `customer_notes` text, `equipment` text, `priority` (`normal | high | urgent`).
- RLS: managers of the trailer can read; outgoing can write while draft; incoming can update read/accepted.

### Flow
1. Outgoing manager opens `/handoff` → fills 6 sections + selects incoming manager → **Send**.
2. Auto-creates an `alerts` row (`shift_handoff`, assigned to that manager).
3. Incoming opens the handoff → marks **Read** (auto on open) → **Accept** with optional note.
4. Status badge on dashboard until accepted; overdue (>1 hr unread) escalates to Owner.

### UI
- New route `/handoff` with two tabs: **Outgoing (compose/sent)** and **Incoming (to acknowledge)**.
- Dashboard tile: "Pending handoff from [name]" with one-click open.
- Nav tab: "Handoff" (Manager + Owner).

---

## Decisions I need

1. **Phase order:** ship Phase 1 (Change Log) first, then Phase 2 (Handoff)? Or reverse?
2. **Change Log — required reason?** Require a reason on schedule unlock, hours adjust, and alert close, or keep reason optional everywhere?
3. **Handoff acknowledgement:** must the incoming manager be **clocked in** before accepting, or can they accept from anywhere (e.g. on their way in)?
4. **Handoff escalation:** if not accepted within 1 hour of `sent_at`, alert the Owner — sound right, or different SLA?

Reply with answers (or "your call, build it") and I'll start Phase 1.
