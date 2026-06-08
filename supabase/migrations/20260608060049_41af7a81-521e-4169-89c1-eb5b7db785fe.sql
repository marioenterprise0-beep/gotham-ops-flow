
-- 1) Tighten alerts INSERT policy: managers/owners only.
DROP POLICY IF EXISTS "alerts insert any auth" ON public.alerts;
CREATE POLICY "alerts insert mgr or owner"
  ON public.alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager(auth.uid()));

-- 2) Private config table for the dispatch secret.
CREATE TABLE IF NOT EXISTS public.email_dispatch_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dispatch_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No grants to anon/authenticated => unreachable via PostgREST.
GRANT ALL ON public.email_dispatch_config TO service_role;
ALTER TABLE public.email_dispatch_config ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only service_role (and SECURITY DEFINER) can read.

-- Seed a random secret if not present.
INSERT INTO public.email_dispatch_config (id, dispatch_key)
VALUES (1, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- 3) Trigger now reads the secret from the private table and includes it
--    as the x-dispatch-key header on every webhook call.
CREATE OR REPLACE FUNCTION public.notify_alert_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text := 'https://project--75d61e5b-6b41-4f7e-a315-ad4632c539dd.lovable.app/api/public/hooks/alert-email-dispatch';
  v_key text;
  v_headers jsonb := '{"Content-Type":"application/json"}'::jsonb;
BEGIN
  IF NEW.email_status = 'none' THEN
    SELECT dispatch_key INTO v_key FROM public.email_dispatch_config WHERE id = 1;
    IF v_key IS NULL OR length(v_key) = 0 THEN
      RETURN NEW; -- no key configured; skip dispatch (fail-closed)
    END IF;
    v_headers := v_headers || jsonb_build_object('x-dispatch-key', v_key);

    PERFORM net.http_post(
      url := v_url,
      headers := v_headers,
      body := jsonb_build_object('alert_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END
$function$;
