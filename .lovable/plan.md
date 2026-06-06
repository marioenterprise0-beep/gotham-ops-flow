# Modules 11 + 12 + 13 — Health Score, Command Center, Employee Profile

Three connected modules. Recommend shipping in this order so each builds on the last.

---

## Phase 1 — Module 11: Store Health Score

**Goal:** One 0–100 number per trailer per day that summarizes operation quality.

### Formula (weighted, all already in the DB)
- **Opening** 10% — shift opened on time? (`shifts.opened_at` vs schedule start)
- **Inventory** 15% — % items at/above `low_threshold` (no critical lows)
- **Labor** 15% — scheduled hours vs actual punched (deviation penalty)
- **Training** 10% — % active employees with `training_completed_at` in last 90 days
- **Checklist** 20% — % of today's `tasks` completed (weighted by `requires_signoff`)
- **Hospitality** 15% — `100 - (incidents × severity weight)` from `hospitality_incidents`
- **Alerts** 15% — `100 - (open critical × 20 + open high × 10 + open normal × 3)`, clamped

Bands: ≥80 Green, 60–79 Yellow, <60 Red.

### Implementation
- Server fn `getHealthScore({ scope: trailer | company, range: today | week | month })` — computes live from existing tables (no new table needed for v1).
- New route `/health` with a big number, color band, sparkline of last 14 days, and a breakdown card per component (score + 1-line explanation).
- Dashboard tile on home: "Store Health · 87 · Green".

---

## Phase 2 — Module 12: Owner Command Center

**Goal:** Owner opens one screen and sees everything.

### Layout (`/command` route, owner-only)
A dense grid of 9 widgets, each linking to its full page:

1. **Open Alerts** — count + top 3 critical (acknowledge inline).
2. **Pending Approvals** — time corrections + time-off + orders awaiting owner review.
3. **Inventory Orders** — submitted/pending count + total $.
4. **Labor** — today's hours vs scheduled, OT risk.
5. **Performance** — top 3 / bottom 3 by recent activity.
6. **Schedule Status** — current week: draft / published / locked.
7. **Daily Recaps** — last 3 with shift score; unreviewed badge.
8. **Health Score** — number + band per trailer.
9. **Recent Changes** — last 5 from `change_log`.

Inline actions per widget: Approve, Review, Comment, Assign.
Add nav tab "Command" (owner only) above Dashboard.

---

## Phase 3 — Module 13: Employee Profile

**Goal:** One page per employee with everything about them. Historical records are read-only.

### Route `/employees/$id` (manager + owner)
Tabs:
- **Overview** — role, trailer, contact, current week hours, health KPIs.
- **Schedule** — upcoming shifts from `schedule_shifts`.
- **Hours** — `time_punches` history (read-only past, edit current open only).
- **Performance** — score over time, recent positives/negatives.
- **Training** — completed/in-progress/expired (uses `profiles.training_completed_at` + future `training_assignments`).
- **Corrections** — `time_corrections` history.
- **Time Off** — `time_off_requests` history.
- **Certifications** — SOPs accepted, sign-offs.
- **Notes** — `shift_notes` thread (manager-visible).
- **Manager Comments** — new lightweight table `employee_comments` (manager-only, append-only).
- **History** — merged `change_log` + `audit_log` filtered to this employee.

### Rule enforcement
- All historical tabs render with disabled inputs for employees.
- Edits route through existing server fns (which already write to `change_log`).
- New tiny table `employee_comments` (manager_id, employee_id, body, created_at) — managers insert, all managers + the employee can read.

### Nav
- "Users" page (already exists) — make each row clickable into `/employees/$id`.

---

## Decisions I need

1. **Phase order:** 11 → 12 → 13 as listed, or different?
2. **Health Score weights** — defaults above OK, or do you want different weights (e.g. labor heavier than training)?
3. **Manager Comments visibility** — can the employee see comments left about them, or managers-only?
4. **Command Center default trailer** — show owner all trailers stacked, or one-at-a-time with the existing trailer switcher?

Reply with answers (or "your call, build it all") and I'll start Phase 1.
