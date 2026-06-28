-- Cron dispatch config: single-row table holding URL + rollover key the pg_cron
-- jobs read at run-time. Rotating the key later = UPDATE one row, no new migration.

CREATE TABLE IF NOT EXISTS public.cron_dispatch_config (
  id smallint PRIMARY KEY DEFAULT 1,
  app_url text NOT NULL,
  rollover_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cron_dispatch_config_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.cron_dispatch_config TO authenticated;
GRANT ALL ON public.cron_dispatch_config TO service_role;

ALTER TABLE public.cron_dispatch_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read cron config" ON public.cron_dispatch_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "owners write cron config" ON public.cron_dispatch_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Seed row with the deployed app URL. Key is set separately via UPDATE (never committed).
INSERT INTO public.cron_dispatch_config (id, app_url, rollover_key)
VALUES (1, 'https://gothamhalaldash.lovable.app', NULL)
ON CONFLICT (id) DO UPDATE SET app_url = EXCLUDED.app_url;

-- Replace any prior shift-reminder jobs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shift-reminder-tomorrow') THEN
    PERFORM cron.unschedule('shift-reminder-tomorrow');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shift-reminder-today') THEN
    PERFORM cron.unschedule('shift-reminder-today');
  END IF;
END $$;

-- Tomorrow reminder: 8 AM UTC daily. URL + key resolved from cron_dispatch_config at run-time.
SELECT cron.schedule(
  'shift-reminder-tomorrow',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT app_url FROM public.cron_dispatch_config WHERE id = 1) || '/api/public/hooks/shift-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-rollover-key', (SELECT rollover_key FROM public.cron_dispatch_config WHERE id = 1)
      ),
      body    := '{"reminder_for":"tomorrow"}'::jsonb
    )
  $$
);

-- Today reminder: 10 AM UTC daily.
SELECT cron.schedule(
  'shift-reminder-today',
  '0 10 * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT app_url FROM public.cron_dispatch_config WHERE id = 1) || '/api/public/hooks/shift-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-rollover-key', (SELECT rollover_key FROM public.cron_dispatch_config WHERE id = 1)
      ),
      body    := '{"reminder_for":"today"}'::jsonb
    )
  $$
);