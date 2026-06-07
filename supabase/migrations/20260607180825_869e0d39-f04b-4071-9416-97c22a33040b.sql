
-- Alert ↔ email sync columns
DO $$ BEGIN
  CREATE TYPE public.alert_email_status AS ENUM ('none','queued','sent','failed','suppressed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS email_status public.alert_email_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS email_message_id text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_template text;

ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS alert_id uuid,
  ADD COLUMN IF NOT EXISTS source_module text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

CREATE INDEX IF NOT EXISTS email_send_log_alert_idx ON public.email_send_log(alert_id);
CREATE UNIQUE INDEX IF NOT EXISTS email_send_log_alert_recipient_unique
  ON public.email_send_log(alert_id, recipient_email, template_name)
  WHERE alert_id IS NOT NULL;

-- Notification preferences
DO $$ BEGIN
  CREATE TYPE public.email_frequency AS ENUM ('immediate','daily_digest','critical_only','off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  email_enabled boolean NOT NULL DEFAULT true,
  frequency public.email_frequency NOT NULL DEFAULT 'immediate',
  categories jsonb NOT NULL DEFAULT '{"schedule":true,"time_clock":true,"inventory":true,"cash":true,"operations":true,"training":true,"announcements":true,"critical":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prefs self read" ON public.notification_preferences;
CREATE POLICY "prefs self read" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "prefs self upsert" ON public.notification_preferences;
CREATE POLICY "prefs self upsert" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'));

DROP POLICY IF EXISTS "prefs self update" ON public.notification_preferences;
CREATE POLICY "prefs self update" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'owner'));

CREATE TRIGGER notification_preferences_touch
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Profile email column (for sending; mirrors auth.users.email at upsert time)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Dispatcher trigger: when an alert is inserted, ping a public hook via pg_net
CREATE OR REPLACE FUNCTION public.notify_alert_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url text := 'https://project--75d61e5b-6b41-4f7e-a315-ad4632c539dd.lovable.app/api/public/hooks/alert-email-dispatch';
BEGIN
  -- Only dispatch for fresh alerts that should generate email
  IF NEW.email_status = 'none' THEN
    PERFORM net.http_post(
      url := v_url,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('alert_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS alerts_dispatch_email ON public.alerts;
CREATE TRIGGER alerts_dispatch_email
  AFTER INSERT ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_alert_email();
