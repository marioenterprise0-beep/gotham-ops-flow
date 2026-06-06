# Labor Control System — Scheduling, Time Clock, Weekly Hours

Turns the existing `/schedule` route into a Shiftlab-style labor system with clock in/out, weekly hour calculation, corrections, time off, and owner-only approval.

## 1. Database (single migration)

New tables (all RLS-locked, trailer-scoped, with grants):

- **`time_punches`** — clock in/out records
  - `employee_id`, `trailer_id`, `schedule_shift_id` (nullable), `clock_in_at`, `clock_out_at`, `break_minutes`, `worked_minutes` (generated), `status` (open/closed/edited), `device_info`, `created_at`
- **`time_corrections`** — employee correction requests
  - `employee_id`, `punch_id` (nullable), `schedule_shift_id` (nullable), `type` (missed_in/missed_out/wrong_time/extra/other), `requested_in`, `requested_out`, `reason`, `status` (pending/approved/declined/info), `decided_by`, `decided_at`, `decision_note`
- **`time_off_requests`** — PTO requests
  - `employee_id`, `start_date`, `end_date`, `start_time` (nullable), `end_time` (nullable), `full_day`, `reason`, `status`, `decided_by`, `decided_at`, `decision_note`
- **`shift_notes`** — employee notes
  - `employee_id`, `schedule_shift_id` (nullable), `punch_id` (nullable), `note`, `created_at`
- **`time_audit`** — immutable audit trail for every hour change
  - `actor_id`, `entity` (punch/correction/timeoff/schedule_shift), `entity_id`, `action`, `old_value` jsonb, `new_value` jsonb, `reason`, `created_at`

RLS:
- Employees: SELECT/INSERT own rows only
- Managers: SELECT all in their scope, INSERT notes
- Owners: full UPDATE/approve on punches, corrections, time off
- `time_audit`: SELECT for managers/owners, INSERT via triggers only

Triggers: write to `time_audit` on any UPDATE of `time_punches` or status change on corrections/time off.

Helper functions:
- `payroll_week_bounds(_date date)` → Sat–Fri range
- `weekly_hours(_user uuid, _week_start date)` → { scheduled_min, worked_min, diff_min, flags[] }

## 2. Server functions (`src/lib/`)

- **`timeclock.functions.ts`** — `clockIn`, `clockOut`, `getMyActivePunch`, `getMyWeek`
- **`labor.functions.ts`** — `getLaborDashboard({ trailerId, weekStart })`, `getEmployeeWeek({ userId, weekStart })`, `listPunches`, `ownerEditPunch` (owner only), `ownerApproveCorrection`, `ownerApproveTimeOff`
- **`requests.functions.ts`** — `submitCorrection`, `submitTimeOff`, `submitShiftNote`, `listMyRequests`, `listPendingRequests` (managers/owners)

All owner-only mutations gated by `has_role(uid, 'owner')` server-side.

## 3. UI

### `/schedule` (replaces current)
- View switcher: **Day / Week / 2-Week / Month** (Week default)
- Shiftlab-style grid: employees left, days top, draggable shift blocks (click to edit; drag deferred — click+edit only this pass)
- Status badges on each block: draft/submitted/approved/locked/published
- Owner-only lock controls: lock day / lock week / lock month with reason
- Trailer scope honored via existing `TrailerContext`

### `/time-clock` (new, employees)
- Big CLOCK IN / CLOCK OUT / SHIFT COMPLETE button
- Shows today's scheduled shift, current elapsed time
- Week summary card: scheduled vs worked, diff, flags
- "Submit note" / "Request correction" / "Request time off" buttons

### `/labor` (new, managers + owners)
- Header: payroll week Sat–Fri with prev/next
- KPI row: total scheduled, total worked, diff, open shifts, missed clock-outs, pending corrections, pending time off
- Employee table: name, scheduled, worked, diff, flags, status
- Click row → drawer with all punches that week; owner can edit, manager read-only
- Tabs: **Overview / Punches / Corrections / Time Off / Notes**
- Approve/Decline buttons (owner only) on each pending request

### Nav (`AppShell.tsx`)
- Add **Time Clock** (all roles) and **Labor** (managers/owners) to nav
- Existing Schedule tab kept

## 4. Permissions integration
Register new tab keys (`time-clock`, `labor`) in `permissions.tsx` matrix so owners can override per-user.

## 5. Out of scope this pass
- Drag/resize shift blocks (click-to-edit only)
- Geofencing on clock in
- Biometric/photo clock in
- Export to ADP/Gusto (we'll surface a CSV download as a stub)
- Push notifications

---

Approve and I'll ship the migration + all routes/functions in one pass.