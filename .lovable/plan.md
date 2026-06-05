# Gotham OS V2 Rebuild Plan

Keep all visuals (palette, type, cards, nav, mobile-first). This is a **functional** rebuild on top of the existing shell.

Given the size, I'll deliver in **5 sequenced phases**, each independently shippable. I'll execute Phase 1 immediately on approval, then continue through 5 in order unless you redirect.

---

## Phase 1 — User Access System (PRIORITY 1)

**DB migration**
- `invite_codes`: add `trailer_id uuid`, `expires_hours int`, `status` computed view (active/used/expired), `disabled_at timestamptz`
- New `trailers` table (id, name, location, active) — seed "Main Trailer"
- New `access_log` table (user_id, event: login/logout/invite_used/access_revoked, ip, ua, created_at)
- `profiles`: add `trailer_id`, `last_login_at`, `sop_accepted_at`, `training_completed_at`, `active`
- RLS: managers full CRUD; users read self
- Trigger on auth sign-in → write access_log + bump `last_login_at`

**Server fns** (`src/lib/users.functions.ts`)
- `generateInvite({ role, trailerId, expiresHours, note })` → code format `GH-XXXX`
- `listInvites()`, `disableInvite(id)`, `deleteInvite(id)`
- `listUsers()` with last_login, active sessions, role, trailer
- `setUserActive(userId, active)`, `reassignRole`, `reassignTrailer`
- `listAccessLogs(limit)`

**UI**
- New `/users` route (manager-only) with tabs: **Users · Pending Invites · Access Logs**
- Invite generation modal (role, trailer, expiry chips: 1h/24h/7d)
- Copy-to-clipboard, disable, delete actions
- Onboarding flow on `/auth` after code entry: Create Account → SOP Agreement screen → Training checklist → Activate
- Replace current invite UI in `/manager` with link to `/users`

---

## Phase 2 — Inventory Reset (PRIORITY 2 + 3)

**DB**
- New enum `inventory_category`: proteins, bread, produce, cheese, sauces, sides, drinks, packaging, operations
- Migrate old categories → new; wipe seed items, reseed Gotham SKUs from your spec
- `inventory_items`: add `forecast_daily_usage numeric`, `last_counted_by uuid`, `last_counted_at timestamptz`
- New `inventory_transfers` table (item_id, qty, from_trailer, to_trailer, by, at)

**Server fns** — extend `inventory.functions.ts`
- `transferStock`, `adjustCount` (separate from full recount), `getUsageHistory(itemId, days)`
- Forecast = trailing 7d avg usage from receipts − counts
- Coverage days = current_qty / forecast_daily_usage

**UI** — `/inventory`
- New category tabs grouped per spec
- Card shows: Current · PAR · Threshold · Forecast · Coverage · Last Count (name + time) · Variance · status pill
- Action row: Receive · Waste · Transfer · Adjust · History (sheet with sparkline)

---

## Phase 3 — Operations Page Rebuild (PRIORITY 4)

**DB**
- Update task seed templates: replace generic opening/mid/close with **Trailer / Grill / Prep / Front / Team** sections
- `tasks`: add `verified_by uuid`, `verified_at`, `photo_required boolean`
- Storage: ensure `gotham-photos` bucket + signed URL helper

**Server fns**
- Update `ensureShiftPhase` to seed Gotham task templates
- `uploadTaskPhoto(taskId, file)` via signed URL
- `verifyTask(taskId)` — owner/manager verification with timestamp

**UI** — `/operations`
- Sections: Trailer · Grill · Prep · Front · Team (replaces opening/mid/closing tabs, keep emergency)
- Each task: checkbox + camera button (if photo_required) + verification badge
- Footer shows owner + timestamp on every completed task

---

## Phase 4 — New Modules (PRIORITY 5)

5 new routes, each thin but real:

- `/waste` — waste % vs sales, reason breakdown, cost (uses waste_log + cost_per_unit)
- `/hospitality` — already exists; extend with greeting/energy/accuracy/recovery scoring per shift
- `/shift-notes` — new table `shift_notes(shift_id, type: note|problem|win, body, by)`
- `/receiving` — list of `inventory_receipts` grouped by vendor + signoff field
- `/maintenance` — new table `maintenance_issues(trailer_id, equipment, severity, status, reported_by, resolved_at)`
- `/labor` — roster from profiles + today's attendance from shift open/close + task assignments

Add to nav under a "More" group on mobile, sidebar on desktop.

---

## Phase 5 — System Rules Enforcement

- `audit_log` already exists — add helper `writeAudit()` called from **every** mutation server fn (sweep all `.functions.ts`)
- Verification requirement: any task with `requires_signoff` blocks shift close until verified
- Mobile 3-tap audit: review and shorten flows where needed
- `/audit` viewer already exists; add filters by entity + actor

---

## Technical notes

- All new tables: GRANT to authenticated + service_role, RLS enabled, manager-write policies via `is_manager()`
- All server fns use `requireSupabaseAuth`; admin client only for cross-user reads
- No visual changes — reuse `Card`, `StatusPill`, `RoleBadge`, `ProgressBar`, color tokens
- Migrations split per phase so each can be reviewed independently

---

**Scope check before I start:**
- ~6 migrations, ~12 new/edited server fn files, ~8 new routes, ~10 edited routes
- Estimated 4–5 turns of work. I'll ship Phase 1 end-to-end first, pause for you to verify the invite flow works, then continue.

Approve and I'll start with Phase 1 (Users + Invites).