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
    -- Optional shared secret: set with
    --   ALTER DATABASE postgres SET app.dispatch_key = '<secret>';
    -- Must match the ROLLOVER_DISPATCH_KEY env var on the server.
    BEGIN
      v_key := current_setting('app.dispatch_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_key := NULL;
    END;
    IF v_key IS NOT NULL AND length(v_key) > 0 THEN
      v_headers := v_headers || jsonb_build_object('x-dispatch-key', v_key);
    END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := v_headers,
      body := jsonb_build_object('alert_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $function$;