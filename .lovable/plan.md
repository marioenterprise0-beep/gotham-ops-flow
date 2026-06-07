
This is a big build — at least 6 distinct systems. To ship it safely without breaking what already works, I'll deliver it in 4 phases. Each phase is independently usable; we ship + verify before starting the next.

## Phase 1 — Daily Rollover Engine (3 AM, location-based)

What it does, at 3 AM trailer-local time:
- Auto-close any active shift; archive notes/recap.
- Auto-clock-out anyone still punched in. Marks punch `status = auto_closed`, reason `System Auto Clock Out`, clock-out stamped at rollover time. Manager + employee notifications created. Original punch preserved; corrections use the existing time-correction flow.
- Mark all incomplete tasks (`opening`, `mid`, `closing`, `emergency` + daily/shift tasks) as `missed`. Yesterday's checklist is archived (read-only), not deleted. New shift container ready for the next day's open.
- Reset *daily forms only* on inventory: daily count status, order requests, receiving queue. **Quantities, par levels, history untouched.**
- Alerts: nothing deleted. Status buckets: `open`, `resolved`, `archived`. Only `open` shown by default; archived stay searchable.
- Writes one `daily_rollover` audit row per trailer with counts (shifts closed, punches auto-closed, tasks missed, etc.).

How:
- New TanStack server route `/api/public/hooks/daily-rollover` (signature-verified) plus a SQL function `public.run_daily_rollover(trailer_id, as_of)` doing the work in one transaction.
- `pg_cron` schedules per-trailer at the trailer's local 3 AM (driven by a new `trailers.timezone` column, default `America/New_York`).
- New owner setting toggles: `rollover_enabled`, `rollover_hour` (default 3).

## Phase 2 — Schedule Approval Workflow + Self-Approval

- Statuses extend: `draft → submitted → approved → published`.
- Manager submits → owner gets in-app + email alert → owner approves → lock → publish → crew notified.
- Owner-only setting `manager_self_approval`. When on, manager can approve+publish in one step.
- Every schedule row tracks `approved_by`, `approval_type` (`owner` / `self`), `published_by`, `published_at` (already partially present — wired into UI).
- Audit + change-log entries on each transition.

## Phase 3 — Notification Center (in-app inbox)

- `notifications` table per user: `type` (info / action_needed / approval / critical), `title`, `message`, `source_module`, `source_id`, `action_url`, `read_at`, `archived_at`.
- Inbox UI at `/inbox` with Unread / Read / Archived tabs and the unread-count badge already in the nav.
- Server helper `createNotification(userId, …)` used by all the triggers (rollover, schedule approval, time-off, inventory, etc.).
- Dedupe by `(user_id, source_module, source_id, type)` within a window to satisfy "no duplicates" rule.

## Phase 4 — Email Engine

Two parts:

**4a. Auth emails** (signup confirmation, password reset, etc.) — uses Lovable's built-in email system.

**4b. App emails** — one notification = one email when the user has email enabled. Includes:
- Schedule published, time-off approved, shift changes, missed clock-out, training, inventory approval, cash review, owner notes, announcements, critical alerts (per your list).
- Owner-side: schedule submitted, inventory order submitted, time adjustment request, approval required.
- Per-user preference (`email_enabled`) + per-category opt-out. Owner can disable all email globally.
- Critical alerts send immediately; low-priority bundles into a digest.
- Tracks `queued / sent / delivered / opened / failed / retry`.

This phase **requires an email domain set up on Lovable Cloud first**. I'll prompt you to set that up when we get there.

## Owner Controls (added incrementally with the relevant phase)

Single Settings → Automation panel:
- Enable / disable email (global)
- Enable manager self-approval
- Enable daily rollover
- Rollover time (hour selector, default 3 AM)
- Enable auto-clock-out

## Technical Section

- New tables: `notifications`, `notification_preferences`, `automation_settings` (single row keyed by `owner_scope`), `rollover_runs` (audit). Adds `timezone` to `trailers`, `approval_type` to `schedules`, `auto_closed` enum value to `time_punches.status`.
- New server fns: `runDailyRollover`, `submitSchedule`, `approveSchedule`, `publishSchedule`, `listNotifications`, `markNotificationRead`, `archiveNotification`, `setAutomationSetting`.
- New routes: `/inbox`, plus `Settings → Automation` panel.
- `pg_cron` runs a single dispatcher every 15 minutes that fires per-trailer rollover when local time crosses the configured hour — avoids needing one cron per trailer.
- Emails use Lovable's app-email queue (`@lovable.dev/email-js`) once the domain is verified.

## Open Questions

I'd like to confirm before I start:

1. **Timezone source**: today trailers have no timezone column. OK to default everything to `America/New_York` and let you set per-trailer later? Or do you want to set them now?
2. **"Auto-close approval adjustments"** — when a manager later approves a correction on an auto-closed punch, should that override the auto-close stamp or keep both rows (original + adjustment)? I'd recommend keeping both for audit.
3. **Self-approval default**: off (owner must approve every schedule until they flip the toggle)?
4. **Phase 4 email domain**: do you already own a sending domain you want to use (e.g. `notify.gothamhalaldash.com`), or should I leave Phase 4 until you're ready to point DNS?

Approve the plan and I'll start with Phase 1.
