-- dispatch_daily_rollover() exists, is pure SQL (no HTTP call inside —
-- the /api/public/hooks/daily-rollover.ts webhook route is an optional
-- manual-trigger path, not a dependency), is self-gating via
-- automation_settings.rollover_enabled and an "already ran today (per
-- trailer's own timezone)" check, and calls run_daily_rollover() to
-- close stale shifts/punches and mark unfinished tasks 'missed' for the
-- day. But nothing in this repo ever scheduled it — same gap pattern as
-- missed_clock_out before tonight's fix. Calling it frequently is safe:
-- it only actually does anything once per trailer per day, at that
-- trailer's configured local rollover hour.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-rollover-dispatch') THEN
    PERFORM cron.unschedule('daily-rollover-dispatch');
  END IF;
END $$;
SELECT cron.schedule('daily-rollover-dispatch', '*/15 * * * *', $$ SELECT public.dispatch_daily_rollover(); $$);
