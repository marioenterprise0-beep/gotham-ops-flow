DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.proname, r.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_trailer()          TO authenticated;
GRANT EXECUTE ON FUNCTION public._has_open_alert(alert_type, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_daily_rollover(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_rollover(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_week_start(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trailer_geofence(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_trailer_geofences() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_depths() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)       TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)       TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.payroll_week_start(_d date)
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT _d - ((EXTRACT(DOW FROM _d)::int + 1) % 7);
$$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.payroll_week_start(date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.payroll_week_start(date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.read_email_batch(text, int, int) TO service_role;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, int, int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;