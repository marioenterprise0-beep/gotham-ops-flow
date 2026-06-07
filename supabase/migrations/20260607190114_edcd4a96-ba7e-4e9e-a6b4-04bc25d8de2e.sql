CREATE OR REPLACE FUNCTION public.email_queue_depths()
RETURNS TABLE(queue_name text, depth bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  q text;
  queues text[] := ARRAY['transactional_emails','auth_emails','transactional_emails_dlq','auth_emails_dlq'];
  c bigint;
BEGIN
  FOREACH q IN ARRAY queues LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM pgmq.q_%I', q) INTO c;
      queue_name := q;
      depth := c;
      RETURN NEXT;
    EXCEPTION WHEN undefined_table THEN
      queue_name := q;
      depth := 0;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_queue_depths() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_queue_depths() TO authenticated, service_role;