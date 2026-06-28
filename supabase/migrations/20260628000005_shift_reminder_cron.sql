-- Schedule daily shift reminder emails via pg_cron.
-- Runs at 8 AM UTC (tomorrow reminder) and 10 AM UTC (same-day reminder).
-- The endpoint is /api/public/hooks/shift-reminders, secured by ROLLOVER_DISPATCH_KEY.
-- Replace <APP_URL> with the deployed Lovable URL and <ROLLOVER_KEY> with the env var value.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shift-reminder-tomorrow') THEN
    PERFORM cron.unschedule('shift-reminder-tomorrow');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shift-reminder-today') THEN
    PERFORM cron.unschedule('shift-reminder-today');
  END IF;
END $$;

-- Tomorrow reminder: 8 AM UTC daily
SELECT cron.schedule(
  'shift-reminder-tomorrow',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url       := '<APP_URL>/api/public/hooks/shift-reminders',
      headers   := '{"Content-Type":"application/json","x-rollover-key":"<ROLLOVER_KEY>"}',
      body      := '{"reminder_for":"tomorrow"}'
    )
  $$
);

-- Today reminder: 10 AM UTC daily (catches morning-of)
SELECT cron.schedule(
  'shift-reminder-today',
  '0 10 * * *',
  $$
    SELECT net.http_post(
      url       := '<APP_URL>/api/public/hooks/shift-reminders',
      headers   := '{"Content-Type":"application/json","x-rollover-key":"<ROLLOVER_KEY>"}',
      body      := '{"reminder_for":"today"}'
    )
  $$
);
