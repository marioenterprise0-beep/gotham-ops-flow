--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: alert_action_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_action_kind AS ENUM (
    'comment',
    'approve',
    'decline',
    'request_changes',
    'mark_ordered',
    'mark_received',
    'escalate',
    'resolve',
    'review'
);


--
-- Name: alert_assigned_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_assigned_role AS ENUM (
    'manager',
    'owner',
    'all'
);


--
-- Name: alert_email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_email_status AS ENUM (
    'none',
    'queued',
    'sent',
    'failed',
    'suppressed',
    'skipped'
);


--
-- Name: alert_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_priority AS ENUM (
    'critical',
    'high',
    'normal',
    'low'
);


--
-- Name: alert_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_status AS ENUM (
    'open',
    'pending',
    'approved',
    'declined',
    'resolved',
    'archived'
);


--
-- Name: alert_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_type AS ENUM (
    'missed_clock_out',
    'missed_clock_in',
    'time_adjustment',
    'time_off',
    'inventory_order',
    'low_stock',
    'critical_stock',
    'checklist_failure',
    'manager_note',
    'schedule_approval',
    'maintenance',
    'manager_recap',
    'announcement',
    'hr_document',
    'hr_document_signed',
    'time_off_decided',
    'time_adjustment_decided'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'owner',
    'manager',
    'shift_lead',
    'grill',
    'prep',
    'cashier'
);


--
-- Name: cash_owner_review; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cash_owner_review AS ENUM (
    'pending',
    'approved',
    'correction',
    'flagged'
);


--
-- Name: cash_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cash_session_status AS ENUM (
    'open',
    'pending',
    'closed'
);


--
-- Name: cash_verification; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cash_verification AS ENUM (
    'self',
    'requested',
    'verified'
);


--
-- Name: correction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.correction_type AS ENUM (
    'missed_in',
    'missed_out',
    'wrong_time',
    'extra_time',
    'left_early',
    'stayed_late',
    'other'
);


--
-- Name: email_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_frequency AS ENUM (
    'immediate',
    'daily_digest',
    'critical_only',
    'off'
);


--
-- Name: hr_assignment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hr_assignment_status AS ENUM (
    'pending',
    'viewed',
    'signed',
    'voided'
);


--
-- Name: hr_doc_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hr_doc_category AS ENUM (
    'onboarding',
    'training',
    'hr',
    'operations'
);


--
-- Name: incident_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.incident_severity AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: inventory_change_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inventory_change_action AS ENUM (
    'create',
    'update',
    'delete',
    'archive'
);


--
-- Name: inventory_change_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inventory_change_status AS ENUM (
    'pending',
    'approved',
    'declined',
    'cancelled'
);


--
-- Name: inventory_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inventory_order_status AS ENUM (
    'draft',
    'submitted',
    'pending_owner_review',
    'approved',
    'declined',
    'changes_requested',
    'ordered',
    'received',
    'cancelled'
);


--
-- Name: inventory_order_urgency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inventory_order_urgency AS ENUM (
    'normal',
    'needed_soon',
    'critical',
    'emergency'
);


--
-- Name: location_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.location_request_status AS ENUM (
    'pending',
    'approved',
    'declined',
    'cancelled',
    'used',
    'expired'
);


--
-- Name: maintenance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_status AS ENUM (
    'open',
    'in_progress',
    'resolved'
);


--
-- Name: org_billing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_billing_status AS ENUM (
    'trialing',
    'trial_expired',
    'active',
    'past_due_locked',
    'suspended',
    'cancelled'
);


--
-- Name: org_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_role AS ENUM (
    'org_owner',
    'org_admin',
    'org_member'
);


--
-- Name: punch_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.punch_status AS ENUM (
    'open',
    'closed',
    'edited',
    'voided',
    'auto_closed'
);


--
-- Name: recap_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recap_status AS ENUM (
    'draft',
    'submitted',
    'reviewed',
    'archived'
);


--
-- Name: request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_status AS ENUM (
    'pending',
    'approved',
    'declined',
    'info_requested'
);


--
-- Name: schedule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.schedule_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'locked',
    'published'
);


--
-- Name: shift_phase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_phase AS ENUM (
    'opening',
    'mid',
    'closing',
    'emergency'
);


--
-- Name: shift_segment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_segment AS ENUM (
    'open',
    'mid',
    'close',
    'custom'
);


--
-- Name: shift_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_status AS ENUM (
    'active',
    'closed'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'todo',
    'in_progress',
    'done',
    'signed_off',
    'blocked',
    'missed'
);


--
-- Name: _has_open_alert(public.alert_type, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._has_open_alert(_type public.alert_type, _source_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.alerts
    WHERE type = _type AND source_id = _source_id
      AND status IN ('open','pending'))
$$;


--
-- Name: audit_punch_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_punch_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.time_audit(actor_id, entity, entity_id, action, old_value, new_value)
    VALUES (
      auth.uid(),
      'time_punch',
      NEW.id,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END $$;


--
-- Name: check_hr_assignment_complete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_hr_assignment_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  remaining int;
  v_assignment record;
  v_employee_name text;
BEGIN
  IF NEW.signed_at IS NOT NULL AND OLD.signed_at IS NULL THEN
    SELECT count(*) INTO remaining FROM public.hr_document_signatures
      WHERE assignment_id = NEW.assignment_id AND signed_at IS NULL;
    IF remaining = 0 THEN
      UPDATE public.hr_document_assignments
        SET status = 'signed', completed_at = now()
        WHERE id = NEW.assignment_id
        RETURNING * INTO v_assignment;

      SELECT display_name INTO v_employee_name FROM public.profiles WHERE id = v_assignment.employee_id;

      INSERT INTO public.alerts (type, title, description, source_module, source_id,
        created_by, assigned_user_id, assigned_role, priority, status, payload)
      VALUES ('hr_document_signed',
        'Document fully signed — ' || v_assignment.title,
        COALESCE(v_employee_name, 'Employee') || ' · all signatures complete',
        'hr_documents', v_assignment.id, v_assignment.employee_id,
        v_assignment.assigned_by, 'manager', 'normal', 'pending',
        jsonb_build_object('title', v_assignment.title, 'employee_name', v_employee_name,
          'assignment_id', v_assignment.id));
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: consume_invite_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_invite_code(_code text) RETURNS public.app_role
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_role app_role;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id, role into v_id, v_role
  from public.invite_codes
  where upper(code) = upper(_code)
    and used_by is null
    and expires_at > now()
  for update;

  if v_id is null then
    raise exception 'invalid or expired invite code';
  end if;

  update public.invite_codes
    set used_by = v_uid, used_at = now()
    where id = v_id;

  -- Replace the default 'cashier' role created by handle_new_user with the invite's role
  delete from public.user_roles where user_id = v_uid;
  insert into public.user_roles (user_id, role) values (v_uid, v_role);

  return v_role;
end;
$$;


--
-- Name: current_organization_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_organization_id() RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT NULLIF(current_setting('app.active_organization_id', true), '')::uuid
$$;


--
-- Name: current_user_trailer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_trailer() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH candidate AS (
    SELECT COALESCE(
      (SELECT g.trailer_id
         FROM public.active_location_grants g
        WHERE g.user_id = auth.uid() AND g.expires_at > now()
        ORDER BY g.expires_at DESC LIMIT 1),
      (SELECT p.trailer_id FROM public.profiles p WHERE p.id = auth.uid())
    ) AS tid
  )
  SELECT c.tid
    FROM candidate c
   WHERE c.tid IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.trailers t
        WHERE t.id = c.tid
          AND t.organization_id = public.current_organization_id()
     )
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: availability_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    block_date date NOT NULL,
    all_day boolean DEFAULT true NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'approved'::text NOT NULL,
    trailer_id uuid,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    schedule_id uuid,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT availability_blocks_reason_check CHECK ((char_length(reason) <= 300)),
    CONSTRAINT availability_blocks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);


--
-- Name: decide_availability_atomic(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decide_availability_atomic(_id uuid, _decision text, _note text) RETURNS public.availability_blocks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_row       public.availability_blocks;
  v_decider   text;
  v_org       uuid := public.current_organization_id();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no active organization';
  END IF;
  IF _decision NOT IN ('approved','declined') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT * INTO v_row FROM public.availability_blocks WHERE id = _id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'availability block not found';
  END IF;
  IF v_row.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'cross-tenant reference: block % is not in active organization', _id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_manager(v_uid, v_org) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.availability_blocks
     SET status        = _decision,
         decided_by    = v_uid,
         decided_at    = now(),
         decision_note = NULLIF(_note,'')
   WHERE id = _id
   RETURNING * INTO v_row;

  SELECT display_name INTO v_decider FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.alerts (
    type, title, description, source_module, source_id,
    trailer_id, created_by, assigned_user_id, assigned_role,
    priority, status, payload
  ) VALUES (
    CASE WHEN _decision = 'approved' THEN 'availability_approved'
         ELSE 'availability_declined' END,
    'Unavailability ' || _decision || ' — ' || v_row.block_date::text,
    NULLIF(_note,''),
    'availability', v_row.id, v_row.trailer_id, v_uid, v_row.user_id, 'manager',
    'normal', 'pending',
    jsonb_build_object(
      'decision', _decision,
      'block_date', v_row.block_date,
      'decision_reason', NULLIF(_note,''),
      'decided_by_name', COALESCE(v_decider, 'Management')
    )
  );

  RETURN v_row;
END $$;


--
-- Name: delete_email(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_email(queue_name text, message_id bigint) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;


--
-- Name: dispatch_daily_rollover(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_daily_rollover(_now timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_settings public.automation_settings%ROWTYPE;
  v_count int := 0;
  r record;
BEGIN
  SELECT * INTO v_settings FROM public.automation_settings WHERE scope = 'global' LIMIT 1;
  IF v_settings.id IS NULL OR NOT v_settings.rollover_enabled THEN RETURN 0; END IF;

  FOR r IN
    SELECT t.id, t.timezone
      FROM public.trailers t
     WHERE t.active = true
  LOOP
    -- Fire only when local hour == configured hour and we haven't already run today (local)
    IF EXTRACT(HOUR FROM (_now AT TIME ZONE r.timezone))::int = v_settings.rollover_hour
       AND NOT EXISTS (
         SELECT 1 FROM public.rollover_runs rr
         WHERE rr.trailer_id = r.id
           AND (rr.ran_at AT TIME ZONE r.timezone)::date = (_now AT TIME ZONE r.timezone)::date
       )
    THEN
      PERFORM public.run_daily_rollover(r.id, _now);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END $$;


--
-- Name: email_queue_depths(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_queue_depths() RETURNS TABLE(queue_name text, depth bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pgmq'
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


--
-- Name: email_queue_dispatch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_queue_dispatch() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      -- Serialize disarm against email_queue_wake on a shared advisory lock, then
      -- re-read under it: an enqueue racing the unschedule either committed (we
      -- see its row and leave the cron) or waits and re-arms after we commit.
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
         OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://project--75d61e5b-6b41-4f7e-a315-ad4632c539dd.lovable.app/lovable/email/queue/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$$;


--
-- Name: email_queue_wake(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_queue_wake() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
BEGIN
  -- Runs inside the enqueue transaction; the outer handler guarantees nothing
  -- below can roll back the customer's email. Shared advisory lock serializes
  -- arming against email_queue_dispatch's disarm.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule('process-email-queue', '5 seconds', $cron$ SELECT public.email_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://project--75d61e5b-6b41-4f7e-a315-ad4632c539dd.lovable.app/lovable/email/queue/process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$_$;


--
-- Name: emit_cash_drawer_close_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_cash_drawer_close_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_trailer_name text;
  v_priority alert_priority;
  v_title text;
  v_var numeric;
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    v_var := COALESCE(NEW.variance, 0);
    IF abs(v_var) >= 20 THEN
      v_priority := 'critical';
      v_title := 'Cash Variance — ' || COALESCE(v_trailer_name,'Trailer') || ' · ' ||
                 CASE WHEN v_var >= 0 THEN '+' ELSE '' END || v_var::text;
    ELSIF abs(v_var) >= 5 THEN
      v_priority := 'high';
      v_title := 'Cash Variance — ' || COALESCE(v_trailer_name,'Trailer');
    ELSE
      v_priority := 'normal';
      v_title := 'Drawer Closed — ' || COALESCE(v_trailer_name,'Trailer');
    END IF;

    INSERT INTO public.alerts (
      type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload
    ) VALUES (
      'manager_note', v_title,
      'Counted: ' || COALESCE(NEW.counted_amount::text,'—') ||
      ' · Expected: ' || COALESCE(NEW.expected_amount::text,'—'),
      'cash', NEW.id, NEW.trailer_id, NEW.closed_by, 'owner',
      v_priority, 'pending',
      jsonb_build_object('variance', v_var, 'counted', NEW.counted_amount, 'expected', NEW.expected_amount)
    );
  END IF;
  RETURN NEW;
END $$;


--
-- Name: emit_checklist_failure_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_checklist_failure_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_incomplete_count int;
  v_incomplete_titles text;
  v_trailer_name text;
BEGIN
  IF NEW.end_at IS NOT NULL AND OLD.end_at IS NULL THEN
    SELECT count(*), string_agg(title, ', ' ORDER BY created_at)
      INTO v_incomplete_count, v_incomplete_titles
      FROM public.tasks
      WHERE shift_id = NEW.shift_id AND phase = NEW.phase
        AND status NOT IN ('done', 'signed_off');

    IF v_incomplete_count > 0 THEN
      IF public._has_open_alert('checklist_failure', NEW.id) THEN RETURN NEW; END IF;
      SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
      INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
        created_by, assigned_role, priority, status, payload)
      VALUES ('checklist_failure',
        initcap(NEW.phase::text) || ' checklist incomplete — ' || COALESCE(v_trailer_name, 'Trailer'),
        v_incomplete_count || ' item' || (CASE WHEN v_incomplete_count = 1 THEN '' ELSE 's' END) ||
          ' not completed: ' || v_incomplete_titles,
        'operations', NEW.id, NEW.trailer_id, NEW.created_by, 'manager', 'high', 'pending',
        jsonb_build_object('session_id', NEW.id, 'phase', NEW.phase,
          'incomplete_count', v_incomplete_count, 'incomplete_titles', v_incomplete_titles));
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: emit_hospitality_incident_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_hospitality_incident_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_trailer_name text;
BEGIN
  IF NEW.severity NOT IN ('high','critical') THEN RETURN NEW; END IF;
  IF public._has_open_alert('manager_note', NEW.id) THEN RETURN NEW; END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('manager_note',
    'Guest incident (' || NEW.severity || ') — ' || COALESCE(v_trailer_name,'Trailer'),
    COALESCE(NEW.notes, NEW.type),
    'hospitality', NEW.id, NEW.trailer_id, NEW.logged_by, 'owner',
    CASE WHEN NEW.severity = 'critical' THEN 'critical'::alert_priority ELSE 'high'::alert_priority END,
    'pending',
    jsonb_build_object('severity', NEW.severity, 'type', NEW.type, 'recovery', NEW.recovery_action));
  RETURN NEW;
END $$;


--
-- Name: emit_inventory_order_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_inventory_order_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count int;
  v_critical int;
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    SELECT count(*), count(*) FILTER (WHERE urgency IN ('critical','emergency'))
      INTO v_count, v_critical FROM public.inventory_order_items WHERE order_id = NEW.id;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id, created_by, assigned_role, priority, status, payload)
    VALUES (
      'inventory_order',
      'Inventory Order Submitted — ' || COALESCE(v_trailer_name,'Trailer'),
      v_count || ' items (' || v_critical || ' critical)',
      'inventory', NEW.id, NEW.trailer_id, NEW.created_by, 'owner',
      CASE WHEN v_critical > 0 THEN 'critical'::alert_priority ELSE 'high'::alert_priority END,
      'pending',
      jsonb_build_object('order_id', NEW.id, 'item_count', v_count, 'critical_count', v_critical)
    );
    NEW.submitted_at := now();
    NEW.status := 'pending_owner_review';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: emit_inventory_order_alert_after_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_inventory_order_alert_after_items() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order public.inventory_orders%ROWTYPE;
  v_count int; v_critical int; v_trailer_name text;
  v_existing int;
BEGIN
  SELECT * INTO v_order FROM public.inventory_orders WHERE id = NEW.order_id;
  IF v_order.status <> 'pending_owner_review' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_existing FROM public.alerts WHERE source_id = v_order.id AND type = 'inventory_order';
  IF v_existing > 0 THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE urgency IN ('critical','emergency'))
    INTO v_count, v_critical FROM public.inventory_order_items WHERE order_id = v_order.id;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = v_order.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id, created_by, assigned_role, priority, status, payload)
  VALUES (
    'inventory_order',
    'Inventory Order Submitted — ' || COALESCE(v_trailer_name,'Trailer'),
    v_count || ' items (' || v_critical || ' critical)',
    'inventory', v_order.id, v_order.trailer_id, v_order.created_by, 'owner',
    CASE WHEN v_critical > 0 THEN 'critical'::alert_priority ELSE 'high'::alert_priority END,
    'pending',
    jsonb_build_object('order_id', v_order.id, 'item_count', v_count, 'critical_count', v_critical)
  );
  RETURN NEW;
END $$;


--
-- Name: emit_inventory_order_alert_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_inventory_order_alert_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' THEN
    NEW.status := 'pending_owner_review';
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;


--
-- Name: emit_inventory_threshold_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_inventory_threshold_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_trailer_name text; v_was_above boolean; v_is_critical boolean;
  v_is_low boolean; v_atype alert_type; v_prio alert_priority; v_title text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_qty = OLD.current_qty THEN RETURN NEW; END IF;
  v_was_above := (TG_OP = 'INSERT') OR (OLD.current_qty > OLD.low_threshold);
  v_is_critical := NEW.minimum_qty > 0 AND NEW.current_qty <= NEW.minimum_qty;
  v_is_low := NEW.current_qty <= NEW.low_threshold AND NOT v_is_critical;
  IF NOT v_is_critical AND NOT v_is_low THEN RETURN NEW; END IF;
  IF NOT v_was_above THEN RETURN NEW; END IF;
  IF v_is_critical THEN
    v_atype := 'critical_stock'; v_prio := 'critical';
    v_title := 'Critical stock — ' || NEW.name;
  ELSE
    v_atype := 'low_stock'; v_prio := 'high';
    v_title := 'Low stock — ' || NEW.name;
  END IF;
  IF public._has_open_alert(v_atype, NEW.id) THEN RETURN NEW; END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES (v_atype, v_title,
    'On hand: ' || NEW.current_qty || ' ' || NEW.unit || ' · Threshold: ' || NEW.low_threshold,
    'inventory', NEW.id, NEW.trailer_id, NULL, 'manager', v_prio, 'pending',
    jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
      'name', NEW.name, 'on_hand', NEW.current_qty, 'unit', NEW.unit,
      'threshold', NEW.low_threshold, 'minimum', NEW.minimum_qty))));
  RETURN NEW;
END $$;


--
-- Name: emit_large_cash_drop_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_large_cash_drop_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE v_trailer_name text;
BEGIN
  IF NEW.amount < 500 THEN RETURN NEW; END IF;
  IF public._has_open_alert('manager_note', NEW.id) THEN RETURN NEW; END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('manager_note',
    'Large cash drop $' || NEW.amount::text || ' — ' || COALESCE(v_trailer_name,'Trailer'),
    'Drop code ' || NEW.drop_code || COALESCE(' · ' || NEW.reason, ''),
    'cash', NEW.id, NEW.trailer_id, NEW.submitted_by, 'owner', 'high', 'pending',
    jsonb_build_object('amount', NEW.amount, 'drop_code', NEW.drop_code));
  RETURN NEW;
END $_$;


--
-- Name: emit_maintenance_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_maintenance_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_reporter_name text;
  v_trailer_name text;
BEGIN
  SELECT display_name INTO v_reporter_name FROM public.profiles WHERE id = NEW.reported_by;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('maintenance',
    NEW.title,
    COALESCE(v_trailer_name, 'Trailer') || ' · reported by ' || COALESCE(v_reporter_name, 'Crew'),
    'maintenance', NEW.id, NEW.trailer_id, NEW.reported_by, 'manager', NEW.priority, 'pending',
    jsonb_build_object('request_id', NEW.id, 'description', NEW.description));
  RETURN NEW;
END $$;


--
-- Name: emit_missed_clock_out_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_missed_clock_out_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_emp_name text; v_trailer_name text;
BEGIN
  IF NEW.status = 'auto_closed' AND (OLD.status IS DISTINCT FROM 'auto_closed') THEN
    IF public._has_open_alert('missed_clock_out', NEW.id) THEN RETURN NEW; END IF;
    SELECT display_name INTO v_emp_name FROM public.profiles WHERE id = NEW.employee_id;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload)
    VALUES ('missed_clock_out',
      'Missed clock-out — ' || COALESCE(v_emp_name,'Employee'),
      COALESCE(v_trailer_name,'Trailer') || ' · auto-closed at ' || to_char(NEW.clock_out_at,'HH24:MI'),
      'time_clock', NEW.id, NEW.trailer_id, NEW.employee_id, 'manager', 'high', 'pending',
      jsonb_build_object('punch_id', NEW.id, 'employee_id', NEW.employee_id));
  END IF;
  RETURN NEW;
END $$;


--
-- Name: emit_profile_milestone_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_profile_milestone_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_trailer_name text; v_kind text; v_title text;
BEGIN
  IF NEW.sop_accepted_at IS NOT NULL AND OLD.sop_accepted_at IS NULL THEN
    v_kind := 'sop_accepted';
    v_title := 'SOP accepted — ' || COALESCE(NEW.display_name,'Crew');
  ELSIF NEW.training_completed_at IS NOT NULL AND OLD.training_completed_at IS NULL THEN
    v_kind := 'training_completed';
    v_title := 'Training completed — ' || COALESCE(NEW.display_name,'Crew');
  ELSIF NEW.handbook_acknowledged_at IS NOT NULL AND OLD.handbook_acknowledged_at IS NULL THEN
    v_kind := 'handbook_acknowledged';
    v_title := 'Handbook acknowledged — ' || COALESCE(NEW.display_name,'Crew');
  ELSE
    RETURN NEW;
  END IF;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
    created_by, assigned_role, priority, status, payload)
  VALUES ('manager_note', v_title,
    COALESCE(v_trailer_name,'Trailer') || ' · ' || v_kind,
    'training', NEW.id, NEW.trailer_id, NEW.id, 'manager', 'normal', 'pending',
    jsonb_build_object('kind', v_kind, 'user_id', NEW.id));
  RETURN NEW;
END $$;


--
-- Name: emit_recap_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_recap_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id, created_by, assigned_role, priority, status, payload)
    VALUES (
      'manager_recap',
      'Daily Recap — ' || COALESCE(v_trailer_name,'Trailer') || ' · ' || to_char(NEW.recap_date,'Mon DD'),
      'Shift score: ' || COALESCE(NEW.shift_score::text,'—') || '/10',
      'operations', NEW.id, NEW.trailer_id, NEW.manager_id, 'owner',
      'normal', 'pending',
      jsonb_build_object('recap_id', NEW.id, 'shift_score', NEW.shift_score)
    );
  END IF;
  RETURN NEW;
END $$;


--
-- Name: emit_schedule_published_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_schedule_published_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_trailer_name text;
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    IF public._has_open_alert('manager_note', NEW.id) THEN RETURN NEW; END IF;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    NEW.published_at := COALESCE(NEW.published_at, now());
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload)
    VALUES ('manager_note',
      'Schedule published — ' || COALESCE(v_trailer_name,'Trailer'),
      COALESCE(NEW.name,'Schedule') || ' · ' || NEW.start_date || ' → ' || NEW.end_date,
      'schedule', NEW.id, NEW.trailer_id, NEW.published_by, 'all',
      'normal', 'pending',
      jsonb_build_object('schedule_id', NEW.id, 'trailer_id', NEW.trailer_id,
        'start_date', NEW.start_date, 'end_date', NEW.end_date,
        'event', 'schedule_published'));
  END IF;
  RETURN NEW;
END $$;


--
-- Name: emit_schedule_submitted_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emit_schedule_submitted_alert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    INSERT INTO public.alerts (
      type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload
    ) VALUES (
      'schedule_approval',
      'Schedule Submitted — ' || COALESCE(v_trailer_name,'Trailer'),
      COALESCE(NEW.name, 'Schedule') || ' · ' || NEW.start_date || ' → ' || NEW.end_date,
      'schedule', NEW.id, NEW.trailer_id, NEW.submitted_by, 'owner',
      'high', 'pending',
      jsonb_build_object('schedule_id', NEW.id, 'start_date', NEW.start_date, 'end_date', NEW.end_date)
    );
  END IF;
  RETURN NEW;
END $$;


--
-- Name: enforce_clock_in_geofence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_clock_in_geofence() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_trailer RECORD;
  v_lat double precision;
  v_lng double precision;
  v_acc double precision;
  v_dist double precision;
  v_tol double precision;
  v_radius int;
  v_dlat double precision;
  v_dlng double precision;
  v_a double precision;
BEGIN
  IF NEW.trailer_id IS NULL THEN RETURN NEW; END IF;

  SELECT geofence_lat, geofence_lng, geofence_radius_m, name
    INTO v_trailer
    FROM public.trailers WHERE id = NEW.trailer_id;

  IF v_trailer.geofence_lat IS NULL OR v_trailer.geofence_lng IS NULL THEN
    RETURN NEW;
  END IF;

  v_lat := NULLIF(NEW.device_info #>> '{geo,lat}', '')::double precision;
  v_lng := NULLIF(NEW.device_info #>> '{geo,lng}', '')::double precision;
  v_acc := COALESCE(NULLIF(NEW.device_info #>> '{geo,accuracy}', '')::double precision, 0);

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Location required to clock in at %. Enable location access and try again.', COALESCE(v_trailer.name,'this trailer');
  END IF;

  v_radius := COALESCE(v_trailer.geofence_radius_m, 25);
  -- GPS inside a metal trailer routinely reports 30–80 m accuracy; use the
  -- larger of the phone's reported accuracy and a 50 m floor as edge tolerance
  -- so a good reading at the trailer isn't rejected.
  v_tol := GREATEST(v_acc, 50);

  v_dlat := radians(v_lat - v_trailer.geofence_lat);
  v_dlng := radians(v_lng - v_trailer.geofence_lng);
  v_a := sin(v_dlat/2)^2 + cos(radians(v_trailer.geofence_lat)) * cos(radians(v_lat)) * sin(v_dlng/2)^2;
  v_dist := 6371000 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));

  IF v_dist - v_tol > v_radius THEN
    RAISE EXCEPTION 'You are too far from % (% m away, must be within % m). Clock in once you arrive.',
      COALESCE(v_trailer.name,'the trailer'), round(v_dist)::int, v_radius;
  END IF;

  RETURN NEW;
END $$;


--
-- Name: enforce_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_org_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  reg         public._org_resolution%ROWTYPE;
  derived     uuid;
  fk_value    uuid;
  session_org uuid;
  sql         text;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO reg FROM public._org_resolution WHERE table_name = TG_TABLE_NAME;

  IF reg.fk_table IS NOT NULL THEN
    EXECUTE format('SELECT ($1).%I', reg.fk_column) INTO fk_value USING NEW;
    IF fk_value IS NOT NULL THEN
      sql := format(
        'SELECT organization_id FROM public.%I WHERE %I = $1',
        reg.fk_table, reg.fk_pk
      );
      EXECUTE sql INTO derived USING fk_value;
      IF derived IS NOT NULL THEN
        NEW.organization_id := derived;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  session_org := public.current_organization_id();
  IF session_org IS NOT NULL THEN
    NEW.organization_id := session_org;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'enforce_org_id: cannot resolve organization_id for %.% (no explicit value, no FK-derivable parent, no app.active_organization_id set)',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END $_$;


--
-- Name: enqueue_email(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_email(queue_name text, payload jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;


--
-- Name: explode_hr_signature_rows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.explode_hr_signature_rows() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE role_label text;
BEGIN
  FOREACH role_label IN ARRAY NEW.required_signer_roles LOOP
    INSERT INTO public.hr_document_signatures (assignment_id, signer_role_label)
    VALUES (NEW.id, role_label);
  END LOOP;
  RETURN NEW;
END $$;


--
-- Name: fill_employee_trailer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fill_employee_trailer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.trailer_id IS NULL THEN
    NEW.trailer_id := (SELECT p.trailer_id FROM public.profiles p WHERE p.id = NEW.employee_id);
  END IF;
  RETURN NEW;
END $$;


--
-- Name: fill_schedule_shift_trailer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fill_schedule_shift_trailer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.trailer_id IS NULL THEN
    NEW.trailer_id := COALESCE(
      (SELECT p.trailer_id FROM public.profiles p WHERE p.id = NEW.employee_id),
      (SELECT sc.trailer_id FROM public.schedules sc WHERE sc.id = NEW.schedule_id)
    );
  END IF;
  RETURN NEW;
END $$;


--
-- Name: fill_time_punch_trailer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fill_time_punch_trailer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.trailer_id IS NULL THEN
    NEW.trailer_id := (SELECT p.trailer_id FROM public.profiles p WHERE p.id = NEW.employee_id);
  END IF;
  RETURN NEW;
END $$;


--
-- Name: get_trailer_geofence(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_trailer_geofence(_trailer_id uuid) RETURNS TABLE(id uuid, name text, geofence_lat double precision, geofence_lng double precision, geofence_radius_m integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.name, t.geofence_lat, t.geofence_lng, t.geofence_radius_m
    FROM public.trailers t
   WHERE t.id = _trailer_id
     AND t.organization_id = public.current_organization_id()
     AND public.is_manager(auth.uid(), t.organization_id)
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_default_store uuid;
  v_default_trailer uuid;
  v_code text;
  v_invite_id uuid;
  v_role app_role;
  v_trailer uuid;
begin
  v_code := upper(coalesce(new.raw_user_meta_data->>'invite_code', ''));
  if v_code = '' then raise exception 'invite_code_required'; end if;

  select id, role, trailer_id into v_invite_id, v_role, v_trailer
    from public.invite_codes
    where upper(code) = v_code and used_by is null and disabled_at is null and expires_at > now()
    for update;
  if v_invite_id is null then raise exception 'invalid_or_expired_invite_code'; end if;

  select id into v_default_store from public.stores order by created_at asc limit 1;
  select id into v_default_trailer from public.trailers order by created_at asc limit 1;

  insert into public.profiles (id, display_name, email, store_id, trailer_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.email,
    v_default_store,
    coalesce(v_trailer, v_default_trailer)
  );

  insert into public.user_roles (user_id, role) values (new.id, v_role);
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  update public.invite_codes set used_by = new.id, used_at = now() where id = v_invite_id;
  insert into public.access_log (user_id, event, payload)
  values (new.id, 'invite_used', jsonb_build_object('invite_id', v_invite_id, 'role', v_role));

  return new;
end;
$$;


--
-- Name: has_org_role(uuid, uuid, public.org_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.org_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE user_id = _user_id AND organization_id = _org_id AND org_role = _role
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  org uuid := public.current_organization_id();
BEGIN
  IF org IS NULL THEN
    RAISE EXCEPTION 'has_role: no active organization on session (app.active_organization_id unset)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND organization_id = org
       AND role = _role
  );
END $$;


--
-- Name: has_role(uuid, uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND organization_id = _org_id
       AND role = _role
  )
$$;


--
-- Name: hr_assignment_update_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hr_assignment_update_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_manager(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: cannot edit another employee''s assignment';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'viewed') THEN
      RAISE EXCEPTION 'forbidden: employees cannot change assignment status';
    END IF;
  END IF;

  IF NEW.voided_at         IS DISTINCT FROM OLD.voided_at
   OR NEW.voided_by         IS DISTINCT FROM OLD.voided_by
   OR NEW.void_reason       IS DISTINCT FROM OLD.void_reason
   OR NEW.completed_at      IS DISTINCT FROM OLD.completed_at
   OR NEW.completed_pdf_path IS DISTINCT FROM OLD.completed_pdf_path
   OR NEW.title             IS DISTINCT FROM OLD.title
   OR NEW.body_blocks       IS DISTINCT FROM OLD.body_blocks
   OR NEW.template_id       IS DISTINCT FROM OLD.template_id
   OR NEW.employee_id       IS DISTINCT FROM OLD.employee_id
   OR NEW.assigned_by       IS DISTINCT FROM OLD.assigned_by
   OR NEW.required_signer_roles IS DISTINCT FROM OLD.required_signer_roles
   OR NEW.category          IS DISTINCT FROM OLD.category
  THEN
    RAISE EXCEPTION 'forbidden: employees can only update viewed_at and field_values on their own assignment';
  END IF;

  RETURN NEW;
END
$$;


--
-- Name: is_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_manager(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN public.current_organization_id() IS NULL THEN false
    ELSE public.is_manager(_user_id, public.current_organization_id())
  END
$$;


--
-- Name: is_manager(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_manager(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND organization_id = _org_id
       AND role IN ('owner','manager')
  )
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;


--
-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(profiles.is_super_admin, false) FROM public.profiles WHERE profiles.id = _user_id
$$;


--
-- Name: kiosk_device_required(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kiosk_device_required() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT kiosk_device_required
       FROM public.automation_settings
      WHERE organization_id = public.current_organization_id()
        AND scope = 'global'
      LIMIT 1),
    false)
$$;


--
-- Name: link_time_punch_to_shift(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_time_punch_to_shift() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_shift_id uuid;
BEGIN
  IF NEW.archived_at IS NOT NULL OR NEW.schedule_shift_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT ss.id
    INTO v_shift_id
    FROM public.schedule_shifts ss
    LEFT JOIN public.trailers t ON t.id = ss.trailer_id
   WHERE ss.archived_at IS NULL
     AND ss.employee_id = NEW.employee_id
     AND (NEW.trailer_id IS NULL OR ss.trailer_id = NEW.trailer_id)
     AND ss.shift_date BETWEEN ((NEW.clock_in_at AT TIME ZONE COALESCE(t.timezone, 'America/New_York'))::date - 1)
                          AND ((NEW.clock_in_at AT TIME ZONE COALESCE(t.timezone, 'America/New_York'))::date + 1)
   ORDER BY abs(extract(epoch FROM ((ss.shift_date + ss.start_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York') - NEW.clock_in_at)))
   LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    NEW.schedule_shift_id := v_shift_id;
  END IF;

  RETURN NEW;
END
$$;


--
-- Name: list_trailer_geofences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_trailer_geofences() RETURNS TABLE(id uuid, name text, geofence_lat double precision, geofence_lng double precision, geofence_radius_m integer, active boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.name, t.geofence_lat, t.geofence_lng, t.geofence_radius_m, t.active
    FROM public.trailers t
   WHERE t.organization_id = public.current_organization_id()
     AND public.is_manager(auth.uid(), t.organization_id)
   ORDER BY t.name
$$;


--
-- Name: log_task_template_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_task_template_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_fields text[] := '{}';
  v_next int;
  v_id uuid;
  v_tracked text[] := ARRAY['trailer_id','role','phase','title','description','requires_signoff','position','active'];
  f text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_before := NULL;
    v_after  := to_jsonb(NEW);
    v_id := NEW.id;
    v_fields := v_tracked;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    v_id := NEW.id;
    FOREACH f IN ARRAY v_tracked LOOP
      IF (v_before -> f) IS DISTINCT FROM (v_after -> f) THEN
        v_fields := array_append(v_fields, f);
      END IF;
    END LOOP;
    IF array_length(v_fields, 1) IS NULL THEN
      RETURN NEW; -- nothing meaningful changed
    END IF;
  ELSE
    v_action := 'delete';
    v_before := to_jsonb(OLD);
    v_after  := NULL;
    v_id := OLD.id;
    v_fields := v_tracked;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next
    FROM public.task_template_versions WHERE template_id = v_id;

  INSERT INTO public.task_template_versions
    (template_id, version, action, actor_id, before, after, changed_fields)
  VALUES (v_id, v_next, v_action, auth.uid(), v_before, v_after, v_fields);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;


--
-- Name: move_to_dlq(text, text, bigint, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: my_active_org_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_active_org_roles() RETURNS public.app_role[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  org uuid := public.current_organization_id();
BEGIN
  IF uid IS NULL OR org IS NULL THEN
    RETURN ARRAY[]::app_role[];
  END IF;
  RETURN COALESCE(
    (SELECT array_agg(DISTINCT role)
       FROM public.user_roles
      WHERE user_id = uid AND organization_id = org),
    ARRAY[]::app_role[]
  );
END $$;


--
-- Name: my_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_email() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid()
$$;


--
-- Name: my_trailer_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_trailer_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.trailer_id
    FROM public.profiles p
   WHERE p.id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.trailers t
        WHERE t.id = p.trailer_id
          AND t.organization_id = public.current_organization_id()
     )
$$;


--
-- Name: notify_alert_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_alert_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: payroll_week_start(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_week_start(_d date) RETURNS date
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT _d - ((EXTRACT(DOW FROM _d)::int + 1) % 7);
$$;


--
-- Name: profiles_self_update_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profiles_self_update_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Skip guard for managers/super-admins; they use dedicated flows
  IF public.is_manager(auth.uid()) OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR OLD.id <> auth.uid() THEN
    RETURN NEW;
  END IF;
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     OR NEW.pay_rate     IS DISTINCT FROM OLD.pay_rate
     OR NEW.trailer_id   IS DISTINCT FROM OLD.trailer_id
     OR NEW.store_id     IS DISTINCT FROM OLD.store_id
     OR NEW.active       IS DISTINCT FROM OLD.active
     OR NEW.archived_at  IS DISTINCT FROM OLD.archived_at
     OR NEW.archived_by  IS DISTINCT FROM OLD.archived_by
     OR NEW.archive_reason IS DISTINCT FROM OLD.archive_reason
     OR NEW.email        IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'forbidden: cannot edit privileged profile fields';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: read_email_batch(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;


--
-- Name: request_availability_atomic(date, text, boolean, uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_availability_atomic(_block_date date, _reason text, _requires_approval boolean, _trailer_id uuid, _schedule_id uuid, _schedule_name text, _schedule_status text, _employee_name text) RETURNS public.availability_blocks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
  v_row    public.availability_blocks;
  v_org    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _trailer_id IS NULL THEN
    RAISE EXCEPTION 'trailer id required';
  END IF;

  SELECT t.organization_id INTO v_org
    FROM public.trailers t
   WHERE t.id = _trailer_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'trailer not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.user_id = v_uid AND m.organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'cross-tenant reference: caller is not a member of trailer''s organization'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_status := CASE WHEN _requires_approval THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.availability_blocks AS ab (
    user_id, block_date, all_day, reason, status,
    trailer_id, schedule_id, decided_by, decided_at, decision_note,
    organization_id
  ) VALUES (
    v_uid, _block_date, true, NULLIF(_reason,''), v_status,
    _trailer_id, _schedule_id, NULL, NULL, NULL,
    v_org
  )
  ON CONFLICT (user_id, block_date) DO UPDATE
    SET all_day         = EXCLUDED.all_day,
        reason          = EXCLUDED.reason,
        status          = EXCLUDED.status,
        trailer_id      = EXCLUDED.trailer_id,
        schedule_id     = EXCLUDED.schedule_id,
        organization_id = EXCLUDED.organization_id,
        decided_by      = NULL,
        decided_at      = NULL,
        decision_note   = NULL
  RETURNING * INTO v_row;

  IF _requires_approval THEN
    INSERT INTO public.alerts (
      type, title, description, source_module, source_id,
      trailer_id, created_by, assigned_role, priority, status, payload,
      organization_id
    ) VALUES (
      'availability_request',
      'Unavailability request',
      _block_date::text ||
        CASE WHEN NULLIF(_reason,'') IS NOT NULL THEN ' · ' || _reason ELSE '' END,
      'availability', v_row.id, _trailer_id, v_uid, 'manager',
      'normal', 'pending',
      jsonb_build_object(
        'request_id', v_row.id,
        'block_date', _block_date,
        'reason', NULLIF(_reason,''),
        'schedule_name', _schedule_name,
        'schedule_status', _schedule_status,
        'employee_name', COALESCE(NULLIF(_employee_name,''), 'Employee')
      ),
      v_org
    );
  END IF;

  RETURN v_row;
END $$;


--
-- Name: resolve_time_alerts_from_punch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_time_alerts_from_punch() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor uuid;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_actor := COALESCE(NEW.edited_by, NEW.created_by, NEW.employee_id);

  IF NEW.clock_out_at IS NOT NULL THEN
    UPDATE public.alerts
       SET status = 'resolved',
           resolved_by = v_actor,
           resolved_at = now(),
           resolution = COALESCE(resolution, 'Punch corrected')
     WHERE type = 'missed_clock_out'
       AND source_id = NEW.id
       AND status IN ('open','pending');
  END IF;

  IF NEW.schedule_shift_id IS NOT NULL THEN
    UPDATE public.alerts
       SET status = 'resolved',
           resolved_by = v_actor,
           resolved_at = now(),
           resolution = COALESCE(resolution, 'Punch corrected')
     WHERE type = 'missed_clock_in'
       AND source_id = NEW.schedule_shift_id
       AND status IN ('open','pending');
  END IF;

  RETURN NEW;
END
$$;


--
-- Name: run_clock_sweep(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_clock_sweep() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.sweep_missed_clock_out();
  PERFORM public.sweep_missed_clock_in();
END $$;


--
-- Name: rollover_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rollover_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trailer_id uuid,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    as_of timestamp with time zone NOT NULL,
    shifts_closed integer DEFAULT 0 NOT NULL,
    punches_auto_closed integer DEFAULT 0 NOT NULL,
    tasks_missed integer DEFAULT 0 NOT NULL,
    alerts_archived integer DEFAULT 0 NOT NULL,
    notes text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: run_daily_rollover(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_daily_rollover(_trailer_id uuid, _as_of timestamp with time zone DEFAULT now()) RETURNS public.rollover_runs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_settings public.automation_settings%ROWTYPE;
  v_shifts_closed int := 0;
  v_punches int := 0;
  v_tasks int := 0;
  v_alerts int := 0;
  v_run public.rollover_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM public.automation_settings WHERE scope = 'global' LIMIT 1;
  IF v_settings.id IS NULL OR NOT v_settings.rollover_enabled THEN
    INSERT INTO public.rollover_runs (trailer_id, as_of, notes)
    VALUES (_trailer_id, _as_of, 'skipped: rollover disabled')
    RETURNING * INTO v_run;
    RETURN v_run;
  END IF;

  -- Mark incomplete tasks on active shifts as missed
  WITH active AS (
    SELECT id FROM public.shifts
    WHERE status = 'active' AND (trailer_id = _trailer_id OR _trailer_id IS NULL)
  ),
  upd AS (
    UPDATE public.tasks t
       SET status = 'missed'
     WHERE t.shift_id IN (SELECT id FROM active)
       AND t.status NOT IN ('done', 'signed_off', 'missed')
     RETURNING 1
  )
  SELECT count(*) INTO v_tasks FROM upd;

  -- Auto-close still-active operational shifts
  WITH upd AS (
    UPDATE public.shifts
       SET status = 'closed',
           closed_at = _as_of,
           notes = COALESCE(notes,'') ||
                   CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END ||
                   'Auto-closed by daily rollover at ' || _as_of::text
     WHERE status = 'active' AND (trailer_id = _trailer_id OR _trailer_id IS NULL)
     RETURNING 1
  )
  SELECT count(*) INTO v_shifts_closed FROM upd;

  -- Auto-close open time punches at rollover when enabled.
  -- Skips punches attached to a schedule shift whose schedule is 'locked'
  -- (locked schedules are treated as finalized — do not mutate hours).
  IF COALESCE(v_settings.auto_clock_out_enabled, false) THEN
    WITH upd AS (
      UPDATE public.time_punches tp
         SET clock_out_at = _as_of,
             status = 'auto_closed',
             notes = COALESCE(tp.notes,'') ||
                     CASE WHEN tp.notes IS NULL OR tp.notes = '' THEN '' ELSE E'\n' END ||
                     'Auto clock-out by daily rollover at ' || _as_of::text
       WHERE tp.clock_out_at IS NULL
         AND tp.archived_at IS NULL
         AND (tp.trailer_id = _trailer_id OR _trailer_id IS NULL)
         AND NOT EXISTS (
           SELECT 1
             FROM public.schedule_shifts ss
             JOIN public.schedules s ON s.id = ss.schedule_id
            WHERE ss.id = tp.schedule_shift_id
              AND s.status = 'locked'
         )
       RETURNING 1
    )
    SELECT count(*) INTO v_punches FROM upd;
  END IF;

  -- Archive stale resolved alerts (older than 7d)
  WITH upd AS (
    UPDATE public.alerts
       SET status = 'archived'
     WHERE status = 'resolved'
       AND resolved_at < _as_of - INTERVAL '7 days'
       AND (trailer_id = _trailer_id OR _trailer_id IS NULL)
     RETURNING 1
  )
  SELECT count(*) INTO v_alerts FROM upd;

  INSERT INTO public.rollover_runs (
    trailer_id, as_of, shifts_closed, punches_auto_closed, tasks_missed, alerts_archived
  ) VALUES (
    _trailer_id, _as_of, v_shifts_closed, v_punches, v_tasks, v_alerts
  )
  RETURNING * INTO v_run;

  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, payload)
  VALUES (
    NULL, 'daily_rollover', 'trailer', _trailer_id,
    jsonb_build_object(
      'as_of', _as_of,
      'shifts_closed', v_shifts_closed,
      'punches_auto_closed', v_punches,
      'tasks_missed', v_tasks,
      'alerts_archived', v_alerts
    )
  );

  RETURN v_run;
END $$;


--
-- Name: set_active_org_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_active_org_context() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  org uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  SELECT p.active_organization_id INTO org
    FROM public.profiles p
   WHERE p.id = uid
     AND EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.user_id = uid
          AND m.organization_id = p.active_organization_id
     );
  IF org IS NOT NULL THEN
    PERFORM set_config('app.active_organization_id', org::text, true);
  END IF;
END $$;


--
-- Name: sweep_missed_clock_in(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sweep_missed_clock_in() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_shift record;
  v_start timestamptz;
  v_emp_name text;
  v_trailer_name text;
BEGIN
  FOR v_shift IN
    SELECT ss.id, ss.employee_id, ss.trailer_id, ss.shift_date, ss.start_time, t.timezone
    FROM public.schedule_shifts ss
    JOIN public.schedules s ON s.id = ss.schedule_id
    JOIN public.trailers t ON t.id = ss.trailer_id
    WHERE s.status = 'published'
      AND ss.employee_id IS NOT NULL
      AND now() > (ss.shift_date + ss.start_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York') + interval '20 minutes'
      AND now() < (ss.shift_date + ss.start_time) AT TIME ZONE COALESCE(t.timezone, 'America/New_York') + interval '14 hours'
      AND NOT EXISTS (SELECT 1 FROM public.time_punches p WHERE p.schedule_shift_id = ss.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.time_off_requests tor
        WHERE tor.employee_id = ss.employee_id AND tor.status = 'approved'
          AND ss.shift_date BETWEEN tor.start_date AND tor.end_date
      )
      AND NOT public._has_open_alert('missed_clock_in', ss.id)
  LOOP
    v_start := (v_shift.shift_date + v_shift.start_time) AT TIME ZONE COALESCE(v_shift.timezone, 'America/New_York');
    SELECT display_name INTO v_emp_name FROM public.profiles WHERE id = v_shift.employee_id;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = v_shift.trailer_id;
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id,
      created_by, assigned_role, priority, status, payload)
    VALUES ('missed_clock_in',
      'Missed clock-in — ' || COALESCE(v_emp_name, 'Employee'),
      COALESCE(v_trailer_name, 'Trailer') || ' · scheduled ' ||
        to_char(v_start AT TIME ZONE COALESCE(v_shift.timezone, 'America/New_York'), 'HH12:MI AM') || ', never clocked in',
      'scheduling', v_shift.id, v_shift.trailer_id, v_shift.employee_id, 'manager', 'high', 'pending',
      jsonb_build_object('shift_id', v_shift.id, 'employee_id', v_shift.employee_id));
  END LOOP;
END $$;


--
-- Name: sweep_missed_clock_out(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sweep_missed_clock_out() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Scheduled shifts only: close at the scheduled end time (no padding added to hours).
  -- Only sweep punches that actually started before the scheduled end — a late
  -- clock-in (started after scheduled end) is treated as unscheduled and left
  -- alone for manager review.
  UPDATE public.time_punches p
  SET status = 'auto_closed',
      clock_out_at = GREATEST(
        (ss.shift_date + ss.end_time
          + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York'),
        p.clock_in_at + interval '1 minute'
      ),
      notes = COALESCE(p.notes,'') ||
              CASE WHEN p.notes IS NULL OR p.notes = '' THEN '' ELSE E'\n' END ||
              'Auto-closed at scheduled end (missed clock-out)'
  FROM public.schedule_shifts ss
  JOIN public.trailers t ON t.id = ss.trailer_id
  WHERE p.status = 'open'
    AND p.archived_at IS NULL
    AND p.schedule_shift_id = ss.id
    AND p.clock_in_at < ((ss.shift_date + ss.end_time
          + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York'))
    AND now() > ((ss.shift_date + ss.end_time
          + CASE WHEN ss.end_time <= ss.start_time THEN interval '1 day' ELSE interval '0 day' END)
          AT TIME ZONE COALESCE(t.timezone, 'America/New_York')) + interval '2 hours';

  -- Unscheduled open punches: do NOT auto-close (would inflate hours arbitrarily).
END $$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ begin new.updated_at = now(); return new; end $$;


--
-- Name: _org_resolution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._org_resolution (
    table_name text NOT NULL,
    fk_column text,
    fk_table text,
    fk_pk text DEFAULT 'id'::text NOT NULL
);


--
-- Name: access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event text NOT NULL,
    ip text,
    user_agent text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: active_location_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_location_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trailer_id uuid NOT NULL,
    request_id uuid,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: alert_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action public.alert_action_kind NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: alert_category_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_category_reads (
    user_id uuid NOT NULL,
    category text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.alert_type NOT NULL,
    title text NOT NULL,
    description text,
    source_module text NOT NULL,
    source_id uuid,
    trailer_id uuid,
    created_by uuid,
    assigned_role public.alert_assigned_role DEFAULT 'manager'::public.alert_assigned_role NOT NULL,
    priority public.alert_priority DEFAULT 'normal'::public.alert_priority NOT NULL,
    status public.alert_status DEFAULT 'open'::public.alert_status NOT NULL,
    resolution text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_user_id uuid,
    email_status public.alert_email_status DEFAULT 'none'::public.alert_email_status NOT NULL,
    email_message_id text,
    email_sent_at timestamp with time zone,
    email_error text,
    email_template text,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);

ALTER TABLE ONLY public.alerts REPLICA IDENTITY FULL;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: automation_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text DEFAULT 'global'::text NOT NULL,
    rollover_enabled boolean DEFAULT true NOT NULL,
    rollover_hour smallint DEFAULT 3 NOT NULL,
    auto_clock_out_enabled boolean DEFAULT true NOT NULL,
    manager_self_approval boolean DEFAULT false NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    kiosk_device_required boolean DEFAULT false NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT automation_settings_rollover_hour_check CHECK (((rollover_hour >= 0) AND (rollover_hour <= 23)))
);


--
-- Name: cash_drawer_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_drawer_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drawer_id uuid NOT NULL,
    trailer_id uuid NOT NULL,
    status public.cash_session_status DEFAULT 'open'::public.cash_session_status NOT NULL,
    starting_float numeric DEFAULT 0 NOT NULL,
    total_cash_sales numeric,
    counted_amount numeric,
    expected_amount numeric,
    variance numeric,
    variance_reason text,
    verification public.cash_verification DEFAULT 'self'::public.cash_verification NOT NULL,
    owner_review public.cash_owner_review DEFAULT 'pending'::public.cash_owner_review NOT NULL,
    owner_note text,
    owner_reviewed_by uuid,
    owner_reviewed_at timestamp with time zone,
    opened_by uuid NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    pdf_path text,
    pdf_uploaded_at timestamp with time zone,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: cash_drawers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_drawers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trailer_id uuid NOT NULL,
    name text NOT NULL,
    starting_float numeric DEFAULT 150 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: cash_drops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_drops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    drawer_id uuid NOT NULL,
    trailer_id uuid NOT NULL,
    drop_code text NOT NULL,
    amount numeric NOT NULL,
    reason text,
    notes text,
    submitted_by uuid NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT cash_drops_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    actor_name text,
    entity text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    summary text,
    before jsonb,
    after jsonb,
    reason text,
    trailer_id uuid,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: checklist_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift_id uuid NOT NULL,
    phase public.shift_phase NOT NULL,
    trailer_id uuid,
    employee_name text,
    manager_name text,
    manager_initials text,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: cron_dispatch_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_dispatch_config (
    id smallint DEFAULT 1 NOT NULL,
    app_url text NOT NULL,
    rollover_key text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cron_dispatch_config_singleton CHECK ((id = 1))
);


--
-- Name: daily_recaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_recaps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recap_date date DEFAULT CURRENT_DATE NOT NULL,
    shift_id uuid,
    manager_id uuid NOT NULL,
    trailer_id uuid,
    location text,
    crew jsonb DEFAULT '[]'::jsonb NOT NULL,
    shift_score integer,
    status public.recap_status DEFAULT 'draft'::public.recap_status NOT NULL,
    ops_went_well text,
    ops_slowed text,
    ops_attention text,
    inv_low_stock text,
    inv_concerns text,
    inv_orders text,
    labor_attendance text,
    labor_staffing text,
    labor_performance text,
    hosp_feedback text,
    hosp_wins text,
    hosp_complaints text,
    next_shift_notes text,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    owner_comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    kind text DEFAULT 'manager'::text NOT NULL,
    crew_summary text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT daily_recaps_kind_check CHECK ((kind = ANY (ARRAY['crew'::text, 'manager'::text]))),
    CONSTRAINT daily_recaps_shift_score_check CHECK (((shift_score IS NULL) OR ((shift_score >= 1) AND (shift_score <= 10))))
);


--
-- Name: email_dispatch_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_dispatch_config (
    id integer DEFAULT 1 NOT NULL,
    dispatch_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_dispatch_config_id_check CHECK ((id = 1))
);


--
-- Name: email_send_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    template_name text NOT NULL,
    recipient_email text NOT NULL,
    status text NOT NULL,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    alert_id uuid,
    source_module text,
    source_id uuid,
    subject text,
    retry_count integer DEFAULT 0 NOT NULL,
    opened_at timestamp with time zone,
    organization_id uuid,
    CONSTRAINT email_send_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'suppressed'::text, 'failed'::text, 'bounced'::text, 'complained'::text, 'dlq'::text])))
);


--
-- Name: email_send_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_state (
    id integer DEFAULT 1 NOT NULL,
    retry_after_until timestamp with time zone,
    batch_size integer DEFAULT 10 NOT NULL,
    send_delay_ms integer DEFAULT 200 NOT NULL,
    auth_email_ttl_minutes integer DEFAULT 15 NOT NULL,
    transactional_email_ttl_minutes integer DEFAULT 60 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_send_state_id_check CHECK ((id = 1))
);


--
-- Name: email_unsubscribe_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_unsubscribe_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: employee_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_pins (
    user_id uuid NOT NULL,
    pin_hash text NOT NULL,
    set_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: handbook_acknowledgements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handbook_acknowledgements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    handbook_version integer NOT NULL,
    full_name_typed text NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: handbook_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handbook_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number integer NOT NULL,
    part_title text NOT NULL,
    section_number integer NOT NULL,
    section_title text NOT NULL,
    body_blocks jsonb NOT NULL,
    is_policy boolean DEFAULT false NOT NULL,
    display_order integer NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: hospitality_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospitality_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift_id uuid,
    type text NOT NULL,
    severity public.incident_severity DEFAULT 'low'::public.incident_severity NOT NULL,
    notes text,
    recovery_action text,
    logged_by uuid,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    trailer_id uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: hr_document_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_document_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    template_id uuid,
    title text NOT NULL,
    body_blocks jsonb,
    custom_storage_path text,
    custom_content_type text,
    required_signer_roles text[] DEFAULT '{}'::text[] NOT NULL,
    status public.hr_assignment_status DEFAULT 'pending'::public.hr_assignment_status NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    due_date date,
    viewed_at timestamp with time zone,
    completed_at timestamp with time zone,
    voided_at timestamp with time zone,
    voided_by uuid,
    void_reason text,
    trailer_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    field_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    category public.hr_doc_category,
    completed_pdf_path text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: hr_document_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_document_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    signer_role_label text NOT NULL,
    signer_user_id uuid,
    typed_full_name text,
    signed_at timestamp with time zone,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: hr_document_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_document_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    body_blocks jsonb NOT NULL,
    signer_roles text[] NOT NULL,
    edited_by uuid,
    edited_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: hr_document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doc_code text NOT NULL,
    category public.hr_doc_category NOT NULL,
    title text NOT NULL,
    body_blocks jsonb NOT NULL,
    signer_roles text[] DEFAULT '{}'::text[] NOT NULL,
    owner_only boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: inventory_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requested_by uuid NOT NULL,
    trailer_id uuid,
    target_item_id uuid,
    action public.inventory_change_action NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text,
    status public.inventory_change_status DEFAULT 'pending'::public.inventory_change_status NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: inventory_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_counts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    shift_id uuid,
    count_qty numeric NOT NULL,
    expected_qty numeric,
    variance numeric,
    counted_by uuid,
    counted_at timestamp with time zone DEFAULT now() NOT NULL,
    trailer_id uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    unit text DEFAULT 'unit'::text NOT NULL,
    par_level numeric DEFAULT 0 NOT NULL,
    low_threshold numeric DEFAULT 0 NOT NULL,
    current_qty numeric DEFAULT 0 NOT NULL,
    cost_per_unit numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trailer_id uuid,
    vendor text,
    pack_size text,
    minimum_qty numeric DEFAULT 0 NOT NULL,
    preferred_order_qty numeric DEFAULT 0 NOT NULL,
    estimated_cost numeric DEFAULT 0 NOT NULL,
    last_ordered_at timestamp with time zone,
    last_received_at timestamp with time zone,
    image_url text,
    count_instructions text,
    storage_location text,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: inventory_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    item_id uuid,
    item_name text NOT NULL,
    category text,
    unit text,
    current_qty numeric DEFAULT 0 NOT NULL,
    par_qty numeric DEFAULT 0 NOT NULL,
    requested_qty numeric NOT NULL,
    urgency public.inventory_order_urgency DEFAULT 'normal'::public.inventory_order_urgency NOT NULL,
    reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: inventory_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trailer_id uuid,
    created_by uuid NOT NULL,
    status public.inventory_order_status DEFAULT 'draft'::public.inventory_order_status NOT NULL,
    notes text,
    submitted_at timestamp with time zone,
    decided_by uuid,
    decided_at timestamp with time zone,
    owner_comment text,
    ordered_at timestamp with time zone,
    received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: inventory_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    qty numeric NOT NULL,
    supplier text,
    notes text,
    received_by uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: invite_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    role public.app_role DEFAULT 'cashier'::public.app_role NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    used_by uuid,
    used_at timestamp with time zone,
    note text,
    trailer_id uuid,
    expires_hours integer,
    disabled_at timestamp with time zone,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: location_access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requested_by uuid NOT NULL,
    current_trailer_id uuid,
    requested_trailer_id uuid NOT NULL,
    reason text,
    duration_minutes integer DEFAULT 60 NOT NULL,
    status public.location_request_status DEFAULT 'pending'::public.location_request_status NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    code_hash text,
    code_expires_at timestamp with time zone,
    used_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: maintenance_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trailer_id uuid,
    reported_by uuid NOT NULL,
    title text NOT NULL,
    description text,
    priority public.alert_priority DEFAULT 'normal'::public.alert_priority NOT NULL,
    photo_url text,
    status public.maintenance_status DEFAULT 'open'::public.maintenance_status NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_note text,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    frequency public.email_frequency DEFAULT 'immediate'::public.email_frequency NOT NULL,
    categories jsonb DEFAULT '{"cash": true, "critical": true, "schedule": true, "training": true, "inventory": true, "operations": true, "time_clock": true, "hr_documents": true, "announcements": true}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    quiet_hours_timezone text DEFAULT 'America/New_York'::text NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_role public.org_role DEFAULT 'org_member'::public.org_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status public.org_billing_status DEFAULT 'trialing'::public.org_billing_status NOT NULL,
    trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL
);


--
-- Name: prep_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prep_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logged_by uuid NOT NULL,
    trailer_id uuid,
    shift_id uuid,
    item_name text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit text DEFAULT 'units'::text NOT NULL,
    notes text,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT prep_log_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text DEFAULT 'Crew'::text NOT NULL,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trailer_id uuid,
    last_login_at timestamp with time zone,
    sop_accepted_at timestamp with time zone,
    training_completed_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    email text,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    handbook_acknowledged_at timestamp with time zone,
    is_super_admin boolean DEFAULT false NOT NULL,
    weekly_hours integer DEFAULT 40 NOT NULL,
    pay_rate numeric(6,2),
    active_organization_id uuid,
    CONSTRAINT profiles_weekly_hours_check CHECK (((weekly_hours >= 0) AND (weekly_hours <= 80)))
);


--
-- Name: profiles_with_email; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_with_email WITH (security_invoker='true') AS
 SELECT id,
    display_name,
    store_id,
    created_at,
    updated_at,
    trailer_id,
    last_login_at,
    sop_accepted_at,
    training_completed_at,
    active,
    email
   FROM public.profiles
  WHERE public.is_manager(auth.uid());


--
-- Name: role_email_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_email_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.app_role NOT NULL,
    category text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: schedule_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_id uuid NOT NULL,
    employee_id uuid,
    trailer_id uuid,
    role public.app_role DEFAULT 'cashier'::public.app_role NOT NULL,
    segment public.shift_segment DEFAULT 'mid'::public.shift_segment NOT NULL,
    shift_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_minutes integer DEFAULT 30 NOT NULL,
    notes text,
    repeat_weekly boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);

ALTER TABLE ONLY public.schedule_shifts REPLICA IDENTITY FULL;


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trailer_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status public.schedule_status DEFAULT 'draft'::public.schedule_status NOT NULL,
    created_by uuid,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    locked_by uuid,
    locked_at timestamp with time zone,
    lock_reason text,
    published_by uuid,
    published_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    sales_target numeric(10,2),
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT schedules_sales_target_check CHECK ((sales_target > (0)::numeric))
);


--
-- Name: shift_claim_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_claim_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_shift_id uuid NOT NULL,
    claimant_id uuid NOT NULL,
    trailer_id uuid,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT shift_claim_requests_decision_note_check CHECK ((char_length(decision_note) <= 500)),
    CONSTRAINT shift_claim_requests_reason_check CHECK ((char_length(reason) <= 500)),
    CONSTRAINT shift_claim_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])))
);


--
-- Name: shift_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    trailer_id uuid,
    schedule_shift_id uuid,
    punch_id uuid,
    for_date date,
    note text NOT NULL,
    visibility text DEFAULT 'managers'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: shift_swap_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_swap_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    target_employee_id uuid,
    schedule_shift_id uuid NOT NULL,
    trailer_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    reason text,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT shift_swap_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'approved'::text, 'cancelled'::text])))
);


--
-- Name: shift_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    role public.app_role DEFAULT 'cashier'::public.app_role NOT NULL,
    segment public.shift_segment DEFAULT 'mid'::public.shift_segment NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_minutes integer DEFAULT 30 NOT NULL,
    trailer_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    shift_date date DEFAULT CURRENT_DATE NOT NULL,
    phase public.shift_phase DEFAULT 'opening'::public.shift_phase NOT NULL,
    status public.shift_status DEFAULT 'active'::public.shift_status NOT NULL,
    opened_by uuid,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_by uuid,
    closed_at timestamp with time zone,
    notes text,
    trailer_id uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: sop_acknowledgements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sop_acknowledgements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sop_id uuid NOT NULL,
    user_id uuid NOT NULL,
    version integer NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: sop_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sop_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sop_id uuid NOT NULL,
    storage_path text NOT NULL,
    label text,
    content_type text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: sop_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sop_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sop_id uuid NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    category text NOT NULL,
    role public.app_role,
    pass_standard text,
    edited_by uuid,
    edited_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: sop_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sop_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sop_id uuid NOT NULL,
    user_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: sops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    role public.app_role,
    body text NOT NULL,
    pass_standard text,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    short_name text,
    tagline text,
    support_email text,
    bg_color text,
    fg_color text,
    accent_color text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: suppressed_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppressed_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    reason text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suppressed_emails_reason_check CHECK ((reason = ANY (ARRAY['unsubscribe'::text, 'bounce'::text, 'complaint'::text])))
);


--
-- Name: tab_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tab_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_type text NOT NULL,
    scope_id text NOT NULL,
    tab_key text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    access_level text DEFAULT 'edit'::text NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT tab_permissions_access_level_check CHECK ((access_level = ANY (ARRAY['none'::text, 'view'::text, 'edit'::text]))),
    CONSTRAINT tab_permissions_scope_type_check CHECK ((scope_type = ANY (ARRAY['role'::text, 'user'::text])))
);


--
-- Name: task_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    version integer NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    before jsonb,
    after jsonb,
    changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL,
    CONSTRAINT task_template_versions_action_check CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text])))
);


--
-- Name: task_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trailer_id uuid,
    role public.app_role NOT NULL,
    phase public.shift_phase NOT NULL,
    title text NOT NULL,
    description text,
    requires_signoff boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift_id uuid NOT NULL,
    phase public.shift_phase NOT NULL,
    title text NOT NULL,
    description text,
    assignee_role public.app_role,
    owner_id uuid,
    status public.task_status DEFAULT 'todo'::public.task_status NOT NULL,
    requires_signoff boolean DEFAULT false NOT NULL,
    photo_url text,
    numeric_value numeric,
    text_value text,
    signed_off_by uuid,
    signed_off_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    trailer_id uuid,
    assignee_user_id uuid,
    template_id uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: time_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    entity text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: time_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    trailer_id uuid,
    punch_id uuid,
    schedule_shift_id uuid,
    type public.correction_type NOT NULL,
    for_date date NOT NULL,
    requested_in timestamp with time zone,
    requested_out timestamp with time zone,
    reason text NOT NULL,
    status public.request_status DEFAULT 'pending'::public.request_status NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: time_off_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_off_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    trailer_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    full_day boolean DEFAULT true NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    reason text NOT NULL,
    notes text,
    status public.request_status DEFAULT 'pending'::public.request_status NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: time_punches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_punches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    trailer_id uuid,
    schedule_shift_id uuid,
    clock_in_at timestamp with time zone DEFAULT now() NOT NULL,
    clock_out_at timestamp with time zone,
    break_minutes integer DEFAULT 0 NOT NULL,
    status public.punch_status DEFAULT 'open'::public.punch_status NOT NULL,
    device_info jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_by uuid,
    edited_at timestamp with time zone,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    created_by uuid,
    clock_device_id uuid,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);

ALTER TABLE ONLY public.time_punches REPLICA IDENTITY FULL;


--
-- Name: trailers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trailers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    geofence_lat double precision,
    geofence_lng double precision,
    geofence_radius_m integer DEFAULT 25 NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: trusted_clock_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_clock_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trailer_id uuid NOT NULL,
    label text NOT NULL,
    token_hash text NOT NULL,
    approved_by uuid NOT NULL,
    approved_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    last_used_at timestamp with time zone,
    last_used_ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: waste_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    qty numeric NOT NULL,
    reason text NOT NULL,
    photo_url text,
    logged_by uuid,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    trailer_id uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    archive_reason text,
    organization_id uuid DEFAULT public.current_organization_id() NOT NULL
);


--
-- Name: weekly_rollup_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_rollup_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    week_start date NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    recipients integer DEFAULT 0 NOT NULL,
    enqueued integer DEFAULT 0 NOT NULL,
    notes text
);


--
-- Name: _org_resolution _org_resolution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._org_resolution
    ADD CONSTRAINT _org_resolution_pkey PRIMARY KEY (table_name);


--
-- Name: access_log access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_pkey PRIMARY KEY (id);


--
-- Name: active_location_grants active_location_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_location_grants
    ADD CONSTRAINT active_location_grants_pkey PRIMARY KEY (id);


--
-- Name: alert_actions alert_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_actions
    ADD CONSTRAINT alert_actions_pkey PRIMARY KEY (id);


--
-- Name: alert_category_reads alert_category_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_category_reads
    ADD CONSTRAINT alert_category_reads_pkey PRIMARY KEY (user_id, category);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: automation_settings automation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_settings
    ADD CONSTRAINT automation_settings_pkey PRIMARY KEY (id);


--
-- Name: automation_settings automation_settings_scope_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_settings
    ADD CONSTRAINT automation_settings_scope_key UNIQUE (scope);


--
-- Name: availability_blocks availability_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_pkey PRIMARY KEY (id);


--
-- Name: availability_blocks availability_blocks_user_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_user_date_unique UNIQUE (user_id, block_date);


--
-- Name: cash_drawer_sessions cash_drawer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_sessions
    ADD CONSTRAINT cash_drawer_sessions_pkey PRIMARY KEY (id);


--
-- Name: cash_drawers cash_drawers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawers
    ADD CONSTRAINT cash_drawers_pkey PRIMARY KEY (id);


--
-- Name: cash_drawers cash_drawers_trailer_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawers
    ADD CONSTRAINT cash_drawers_trailer_id_name_key UNIQUE (trailer_id, name);


--
-- Name: cash_drops cash_drops_drop_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drops
    ADD CONSTRAINT cash_drops_drop_code_key UNIQUE (drop_code);


--
-- Name: cash_drops cash_drops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drops
    ADD CONSTRAINT cash_drops_pkey PRIMARY KEY (id);


--
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- Name: checklist_sessions checklist_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_sessions
    ADD CONSTRAINT checklist_sessions_pkey PRIMARY KEY (id);


--
-- Name: checklist_sessions checklist_sessions_shift_id_phase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_sessions
    ADD CONSTRAINT checklist_sessions_shift_id_phase_key UNIQUE (shift_id, phase);


--
-- Name: cron_dispatch_config cron_dispatch_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_dispatch_config
    ADD CONSTRAINT cron_dispatch_config_pkey PRIMARY KEY (id);


--
-- Name: daily_recaps daily_recaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_recaps
    ADD CONSTRAINT daily_recaps_pkey PRIMARY KEY (id);


--
-- Name: email_dispatch_config email_dispatch_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_dispatch_config
    ADD CONSTRAINT email_dispatch_config_pkey PRIMARY KEY (id);


--
-- Name: email_send_log email_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);


--
-- Name: email_send_state email_send_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_state
    ADD CONSTRAINT email_send_state_pkey PRIMARY KEY (id);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_email_key UNIQUE (email);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_token_key UNIQUE (token);


--
-- Name: employee_pins employee_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_pins
    ADD CONSTRAINT employee_pins_pkey PRIMARY KEY (user_id);


--
-- Name: handbook_acknowledgements handbook_acknowledgements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_acknowledgements
    ADD CONSTRAINT handbook_acknowledgements_pkey PRIMARY KEY (id);


--
-- Name: handbook_acknowledgements handbook_acknowledgements_user_id_handbook_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_acknowledgements
    ADD CONSTRAINT handbook_acknowledgements_user_id_handbook_version_key UNIQUE (user_id, handbook_version);


--
-- Name: handbook_sections handbook_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_sections
    ADD CONSTRAINT handbook_sections_pkey PRIMARY KEY (id);


--
-- Name: hospitality_incidents hospitality_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitality_incidents
    ADD CONSTRAINT hospitality_incidents_pkey PRIMARY KEY (id);


--
-- Name: hr_document_assignments hr_document_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_assignments
    ADD CONSTRAINT hr_document_assignments_pkey PRIMARY KEY (id);


--
-- Name: hr_document_signatures hr_document_signatures_assignment_id_signer_role_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_signatures
    ADD CONSTRAINT hr_document_signatures_assignment_id_signer_role_label_key UNIQUE (assignment_id, signer_role_label);


--
-- Name: hr_document_signatures hr_document_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_signatures
    ADD CONSTRAINT hr_document_signatures_pkey PRIMARY KEY (id);


--
-- Name: hr_document_template_versions hr_document_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_template_versions
    ADD CONSTRAINT hr_document_template_versions_pkey PRIMARY KEY (id);


--
-- Name: hr_document_templates hr_document_templates_doc_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_templates
    ADD CONSTRAINT hr_document_templates_doc_code_key UNIQUE (doc_code);


--
-- Name: hr_document_templates hr_document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_templates
    ADD CONSTRAINT hr_document_templates_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_key_key UNIQUE (key);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_change_requests inventory_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_change_requests
    ADD CONSTRAINT inventory_change_requests_pkey PRIMARY KEY (id);


--
-- Name: inventory_counts inventory_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_order_items inventory_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_order_items
    ADD CONSTRAINT inventory_order_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_orders inventory_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_orders
    ADD CONSTRAINT inventory_orders_pkey PRIMARY KEY (id);


--
-- Name: inventory_receipts inventory_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_pkey PRIMARY KEY (id);


--
-- Name: invite_codes invite_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_code_key UNIQUE (code);


--
-- Name: invite_codes invite_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_pkey PRIMARY KEY (id);


--
-- Name: location_access_requests location_access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_access_requests
    ADD CONSTRAINT location_access_requests_pkey PRIMARY KEY (id);


--
-- Name: maintenance_requests maintenance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: prep_log prep_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prep_log
    ADD CONSTRAINT prep_log_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: role_email_policies role_email_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_email_policies
    ADD CONSTRAINT role_email_policies_pkey PRIMARY KEY (id);


--
-- Name: role_email_policies role_email_policies_role_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_email_policies
    ADD CONSTRAINT role_email_policies_role_category_key UNIQUE (role, category);


--
-- Name: rollover_runs rollover_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollover_runs
    ADD CONSTRAINT rollover_runs_pkey PRIMARY KEY (id);


--
-- Name: schedule_shifts schedule_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_shifts
    ADD CONSTRAINT schedule_shifts_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: shift_claim_requests shift_claim_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_claim_requests
    ADD CONSTRAINT shift_claim_requests_pkey PRIMARY KEY (id);


--
-- Name: shift_notes shift_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_notes
    ADD CONSTRAINT shift_notes_pkey PRIMARY KEY (id);


--
-- Name: shift_swap_requests shift_swap_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_pkey PRIMARY KEY (id);


--
-- Name: shift_templates shift_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: sop_acknowledgements sop_acknowledgements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_acknowledgements
    ADD CONSTRAINT sop_acknowledgements_pkey PRIMARY KEY (id);


--
-- Name: sop_acknowledgements sop_acknowledgements_sop_id_user_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_acknowledgements
    ADD CONSTRAINT sop_acknowledgements_sop_id_user_id_version_key UNIQUE (sop_id, user_id, version);


--
-- Name: sop_attachments sop_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_attachments
    ADD CONSTRAINT sop_attachments_pkey PRIMARY KEY (id);


--
-- Name: sop_versions sop_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_versions
    ADD CONSTRAINT sop_versions_pkey PRIMARY KEY (id);


--
-- Name: sop_views sop_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_views
    ADD CONSTRAINT sop_views_pkey PRIMARY KEY (id);


--
-- Name: sops sops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sops
    ADD CONSTRAINT sops_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: suppressed_emails suppressed_emails_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_email_key UNIQUE (email);


--
-- Name: suppressed_emails suppressed_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_pkey PRIMARY KEY (id);


--
-- Name: tab_permissions tab_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tab_permissions
    ADD CONSTRAINT tab_permissions_pkey PRIMARY KEY (id);


--
-- Name: tab_permissions tab_permissions_scope_type_scope_id_tab_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tab_permissions
    ADD CONSTRAINT tab_permissions_scope_type_scope_id_tab_key_key UNIQUE (scope_type, scope_id, tab_key);


--
-- Name: task_template_versions task_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_template_versions
    ADD CONSTRAINT task_template_versions_pkey PRIMARY KEY (id);


--
-- Name: task_templates task_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: time_audit time_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_audit
    ADD CONSTRAINT time_audit_pkey PRIMARY KEY (id);


--
-- Name: time_corrections time_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_corrections
    ADD CONSTRAINT time_corrections_pkey PRIMARY KEY (id);


--
-- Name: time_off_requests time_off_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_off_requests
    ADD CONSTRAINT time_off_requests_pkey PRIMARY KEY (id);


--
-- Name: time_punches time_punches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_punches
    ADD CONSTRAINT time_punches_pkey PRIMARY KEY (id);


--
-- Name: trailers trailers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trailers
    ADD CONSTRAINT trailers_pkey PRIMARY KEY (id);


--
-- Name: trusted_clock_devices trusted_clock_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_clock_devices
    ADD CONSTRAINT trusted_clock_devices_pkey PRIMARY KEY (id);


--
-- Name: trusted_clock_devices trusted_clock_devices_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_clock_devices
    ADD CONSTRAINT trusted_clock_devices_token_hash_key UNIQUE (token_hash);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: waste_log waste_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_log
    ADD CONSTRAINT waste_log_pkey PRIMARY KEY (id);


--
-- Name: weekly_rollup_runs weekly_rollup_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_rollup_runs
    ADD CONSTRAINT weekly_rollup_runs_pkey PRIMARY KEY (id);


--
-- Name: access_log_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_log_organization_id_idx ON public.access_log USING btree (organization_id);


--
-- Name: active_location_grants_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX active_location_grants_organization_id_idx ON public.active_location_grants USING btree (organization_id);


--
-- Name: active_location_grants_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX active_location_grants_user_active_idx ON public.active_location_grants USING btree (user_id, expires_at);


--
-- Name: alert_actions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alert_actions_organization_id_idx ON public.alert_actions USING btree (organization_id);


--
-- Name: alert_category_reads_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alert_category_reads_organization_id_idx ON public.alert_category_reads USING btree (organization_id);


--
-- Name: alerts_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alerts_organization_id_idx ON public.alerts USING btree (organization_id);


--
-- Name: audit_log_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_organization_id_idx ON public.audit_log USING btree (organization_id);


--
-- Name: automation_settings_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_settings_organization_id_idx ON public.automation_settings USING btree (organization_id);


--
-- Name: availability_blocks_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX availability_blocks_organization_id_idx ON public.availability_blocks USING btree (organization_id);


--
-- Name: cash_drawer_sessions_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drawer_sessions_archived_at_idx ON public.cash_drawer_sessions USING btree (archived_at);


--
-- Name: cash_drawer_sessions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drawer_sessions_organization_id_idx ON public.cash_drawer_sessions USING btree (organization_id);


--
-- Name: cash_drawers_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drawers_archived_at_idx ON public.cash_drawers USING btree (archived_at);


--
-- Name: cash_drawers_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drawers_organization_id_idx ON public.cash_drawers USING btree (organization_id);


--
-- Name: cash_drops_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drops_archived_at_idx ON public.cash_drops USING btree (archived_at);


--
-- Name: cash_drops_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drops_organization_id_idx ON public.cash_drops USING btree (organization_id);


--
-- Name: change_log_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_actor_idx ON public.change_log USING btree (actor_id);


--
-- Name: change_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_created_idx ON public.change_log USING btree (created_at DESC);


--
-- Name: change_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_entity_idx ON public.change_log USING btree (entity, entity_id);


--
-- Name: change_log_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_organization_id_idx ON public.change_log USING btree (organization_id);


--
-- Name: checklist_sessions_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checklist_sessions_archived_at_idx ON public.checklist_sessions USING btree (archived_at);


--
-- Name: checklist_sessions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checklist_sessions_organization_id_idx ON public.checklist_sessions USING btree (organization_id);


--
-- Name: daily_recaps_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_recaps_archived_at_idx ON public.daily_recaps USING btree (archived_at);


--
-- Name: daily_recaps_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_recaps_date_idx ON public.daily_recaps USING btree (recap_date DESC);


--
-- Name: daily_recaps_manager_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_recaps_manager_idx ON public.daily_recaps USING btree (manager_id, recap_date DESC);


--
-- Name: daily_recaps_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_recaps_organization_id_idx ON public.daily_recaps USING btree (organization_id);


--
-- Name: daily_recaps_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_recaps_status_idx ON public.daily_recaps USING btree (status);


--
-- Name: daily_recaps_trailer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_recaps_trailer_idx ON public.daily_recaps USING btree (trailer_id, recap_date DESC);


--
-- Name: email_send_log_alert_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_send_log_alert_idx ON public.email_send_log USING btree (alert_id);


--
-- Name: email_send_log_alert_recipient_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_send_log_alert_recipient_unique ON public.email_send_log USING btree (alert_id, recipient_email, template_name) WHERE (alert_id IS NOT NULL);


--
-- Name: email_send_log_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_send_log_organization_id_idx ON public.email_send_log USING btree (organization_id);


--
-- Name: employee_pins_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_pins_organization_id_idx ON public.employee_pins USING btree (organization_id);


--
-- Name: handbook_acknowledgements_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handbook_acknowledgements_organization_id_idx ON public.handbook_acknowledgements USING btree (organization_id);


--
-- Name: handbook_acks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handbook_acks_user_idx ON public.handbook_acknowledgements USING btree (user_id);


--
-- Name: handbook_sections_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX handbook_sections_order_idx ON public.handbook_sections USING btree (display_order);


--
-- Name: handbook_sections_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handbook_sections_organization_id_idx ON public.handbook_sections USING btree (organization_id);


--
-- Name: handbook_sections_policy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX handbook_sections_policy_idx ON public.handbook_sections USING btree (is_policy);


--
-- Name: hospitality_incidents_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hospitality_incidents_archived_at_idx ON public.hospitality_incidents USING btree (archived_at);


--
-- Name: hospitality_incidents_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hospitality_incidents_organization_id_idx ON public.hospitality_incidents USING btree (organization_id);


--
-- Name: hr_assignments_assigned_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_assignments_assigned_by_idx ON public.hr_document_assignments USING btree (assigned_by);


--
-- Name: hr_assignments_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_assignments_employee_idx ON public.hr_document_assignments USING btree (employee_id, status);


--
-- Name: hr_document_assignments_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_document_assignments_organization_id_idx ON public.hr_document_assignments USING btree (organization_id);


--
-- Name: hr_document_signatures_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_document_signatures_organization_id_idx ON public.hr_document_signatures USING btree (organization_id);


--
-- Name: hr_document_template_versions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_document_template_versions_organization_id_idx ON public.hr_document_template_versions USING btree (organization_id);


--
-- Name: hr_document_templates_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_document_templates_organization_id_idx ON public.hr_document_templates USING btree (organization_id);


--
-- Name: hr_signatures_assignment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_signatures_assignment_idx ON public.hr_document_signatures USING btree (assignment_id);


--
-- Name: hr_template_versions_template_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_template_versions_template_idx ON public.hr_document_template_versions USING btree (template_id);


--
-- Name: hr_templates_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_templates_category_idx ON public.hr_document_templates USING btree (category);


--
-- Name: idx_alert_actions_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_actions_archived_at ON public.alert_actions USING btree (archived_at);


--
-- Name: idx_alerts_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_archived_at ON public.alerts USING btree (archived_at);


--
-- Name: idx_alerts_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_assigned ON public.alerts USING btree (assigned_role, status);


--
-- Name: idx_alerts_assigned_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_assigned_user ON public.alerts USING btree (assigned_user_id, status);


--
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);


--
-- Name: idx_cash_drops_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_drops_session ON public.cash_drops USING btree (session_id);


--
-- Name: idx_cash_sessions_drawer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_sessions_drawer ON public.cash_drawer_sessions USING btree (drawer_id, status);


--
-- Name: idx_cash_sessions_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_sessions_trailer ON public.cash_drawer_sessions USING btree (trailer_id, opened_at DESC);


--
-- Name: idx_email_send_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_created ON public.email_send_log USING btree (created_at DESC);


--
-- Name: idx_email_send_log_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_message ON public.email_send_log USING btree (message_id);


--
-- Name: idx_email_send_log_message_sent_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique ON public.email_send_log USING btree (message_id) WHERE (status = 'sent'::text);


--
-- Name: idx_email_send_log_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_recipient ON public.email_send_log USING btree (recipient_email);


--
-- Name: idx_hosp_inc_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hosp_inc_trailer ON public.hospitality_incidents USING btree (trailer_id);


--
-- Name: idx_inv_counts_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_counts_trailer ON public.inventory_counts USING btree (trailer_id);


--
-- Name: idx_inv_items_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_items_trailer ON public.inventory_items USING btree (trailer_id);


--
-- Name: idx_inv_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_order_items_order ON public.inventory_order_items USING btree (order_id);


--
-- Name: idx_inv_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_order_status ON public.inventory_orders USING btree (status);


--
-- Name: idx_inventory_change_requests_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_change_requests_archived_at ON public.inventory_change_requests USING btree (archived_at);


--
-- Name: idx_inventory_counts_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_counts_archived_at ON public.inventory_counts USING btree (archived_at);


--
-- Name: idx_inventory_order_items_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_order_items_archived_at ON public.inventory_order_items USING btree (archived_at);


--
-- Name: idx_inventory_orders_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_orders_archived_at ON public.inventory_orders USING btree (archived_at);


--
-- Name: idx_inventory_receipts_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_receipts_archived_at ON public.inventory_receipts USING btree (archived_at);


--
-- Name: idx_location_access_requests_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_location_access_requests_archived_at ON public.location_access_requests USING btree (archived_at);


--
-- Name: idx_profiles_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_archived_at ON public.profiles USING btree (archived_at);


--
-- Name: idx_schedule_shifts_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_shifts_archived_at ON public.schedule_shifts USING btree (archived_at);


--
-- Name: idx_shift_notes_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_notes_archived_at ON public.shift_notes USING btree (archived_at);


--
-- Name: idx_shifts_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_trailer ON public.shifts USING btree (trailer_id);


--
-- Name: idx_sop_att_sop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sop_att_sop ON public.sop_attachments USING btree (sop_id);


--
-- Name: idx_sop_versions_sop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sop_versions_sop ON public.sop_versions USING btree (sop_id, version DESC);


--
-- Name: idx_sops_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sops_archived_at ON public.sops USING btree (archived_at);


--
-- Name: idx_stores_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_archived_at ON public.stores USING btree (archived_at);


--
-- Name: idx_suppressed_emails_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails USING btree (email);


--
-- Name: idx_tasks_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (assignee_user_id);


--
-- Name: idx_tasks_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_trailer ON public.tasks USING btree (trailer_id);


--
-- Name: idx_trailers_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trailers_archived_at ON public.trailers USING btree (archived_at);


--
-- Name: idx_trusted_devices_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trusted_devices_trailer ON public.trusted_clock_devices USING btree (trailer_id) WHERE (revoked_at IS NULL);


--
-- Name: idx_unsubscribe_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens USING btree (token);


--
-- Name: idx_waste_trailer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_trailer ON public.waste_log USING btree (trailer_id);


--
-- Name: inventory_categories_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_categories_organization_id_idx ON public.inventory_categories USING btree (organization_id);


--
-- Name: inventory_change_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_change_requests_organization_id_idx ON public.inventory_change_requests USING btree (organization_id);


--
-- Name: inventory_counts_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_counts_organization_id_idx ON public.inventory_counts USING btree (organization_id);


--
-- Name: inventory_items_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_organization_id_idx ON public.inventory_items USING btree (organization_id);


--
-- Name: inventory_order_items_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_order_items_organization_id_idx ON public.inventory_order_items USING btree (organization_id);


--
-- Name: inventory_orders_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_orders_organization_id_idx ON public.inventory_orders USING btree (organization_id);


--
-- Name: inventory_receipts_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_receipts_organization_id_idx ON public.inventory_receipts USING btree (organization_id);


--
-- Name: invite_codes_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_codes_organization_id_idx ON public.invite_codes USING btree (organization_id);


--
-- Name: location_access_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_access_requests_organization_id_idx ON public.location_access_requests USING btree (organization_id);


--
-- Name: maintenance_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_requests_organization_id_idx ON public.maintenance_requests USING btree (organization_id);


--
-- Name: maintenance_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_requests_status_idx ON public.maintenance_requests USING btree (status);


--
-- Name: maintenance_requests_trailer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_requests_trailer_idx ON public.maintenance_requests USING btree (trailer_id);


--
-- Name: prep_log_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prep_log_organization_id_idx ON public.prep_log USING btree (organization_id);


--
-- Name: role_email_policies_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX role_email_policies_organization_id_idx ON public.role_email_policies USING btree (organization_id);


--
-- Name: rollover_runs_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollover_runs_organization_id_idx ON public.rollover_runs USING btree (organization_id);


--
-- Name: rollover_runs_trailer_ran_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rollover_runs_trailer_ran_idx ON public.rollover_runs USING btree (trailer_id, ran_at DESC);


--
-- Name: schedule_shifts_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_shifts_employee_idx ON public.schedule_shifts USING btree (employee_id, shift_date);


--
-- Name: schedule_shifts_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_shifts_organization_id_idx ON public.schedule_shifts USING btree (organization_id);


--
-- Name: schedule_shifts_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_shifts_schedule_idx ON public.schedule_shifts USING btree (schedule_id);


--
-- Name: schedule_shifts_unassigned_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedule_shifts_unassigned_unique ON public.schedule_shifts USING btree (schedule_id, shift_date, segment) WHERE (employee_id IS NULL);


--
-- Name: schedules_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_archived_at_idx ON public.schedules USING btree (archived_at);


--
-- Name: schedules_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_organization_id_idx ON public.schedules USING btree (organization_id);


--
-- Name: shift_claim_requests_claimant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_claim_requests_claimant_idx ON public.shift_claim_requests USING btree (claimant_id);


--
-- Name: shift_claim_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_claim_requests_organization_id_idx ON public.shift_claim_requests USING btree (organization_id);


--
-- Name: shift_claim_requests_shift_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_claim_requests_shift_idx ON public.shift_claim_requests USING btree (schedule_shift_id);


--
-- Name: shift_claim_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_claim_requests_status_idx ON public.shift_claim_requests USING btree (status) WHERE (archived_at IS NULL);


--
-- Name: shift_notes_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_notes_organization_id_idx ON public.shift_notes USING btree (organization_id);


--
-- Name: shift_swap_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_swap_requests_organization_id_idx ON public.shift_swap_requests USING btree (organization_id);


--
-- Name: shift_templates_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_templates_archived_at_idx ON public.shift_templates USING btree (archived_at);


--
-- Name: shift_templates_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_templates_organization_id_idx ON public.shift_templates USING btree (organization_id);


--
-- Name: shifts_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_archived_at_idx ON public.shifts USING btree (archived_at);


--
-- Name: shifts_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_organization_id_idx ON public.shifts USING btree (organization_id);


--
-- Name: sop_acknowledgements_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_acknowledgements_organization_id_idx ON public.sop_acknowledgements USING btree (organization_id);


--
-- Name: sop_acks_sop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_acks_sop_idx ON public.sop_acknowledgements USING btree (sop_id);


--
-- Name: sop_acks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_acks_user_idx ON public.sop_acknowledgements USING btree (user_id);


--
-- Name: sop_attachments_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_attachments_organization_id_idx ON public.sop_attachments USING btree (organization_id);


--
-- Name: sop_versions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_versions_organization_id_idx ON public.sop_versions USING btree (organization_id);


--
-- Name: sop_views_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_views_organization_id_idx ON public.sop_views USING btree (organization_id);


--
-- Name: sop_views_sop_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_views_sop_idx ON public.sop_views USING btree (sop_id);


--
-- Name: sop_views_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sop_views_user_idx ON public.sop_views USING btree (user_id);


--
-- Name: sops_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sops_organization_id_idx ON public.sops USING btree (organization_id);


--
-- Name: stores_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_organization_id_idx ON public.stores USING btree (organization_id);


--
-- Name: tab_permissions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tab_permissions_organization_id_idx ON public.tab_permissions USING btree (organization_id);


--
-- Name: task_template_versions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_template_versions_organization_id_idx ON public.task_template_versions USING btree (organization_id);


--
-- Name: task_template_versions_template_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_template_versions_template_idx ON public.task_template_versions USING btree (template_id, version DESC);


--
-- Name: task_templates_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_archived_at_idx ON public.task_templates USING btree (archived_at);


--
-- Name: task_templates_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_lookup_idx ON public.task_templates USING btree (trailer_id, role, phase, active);


--
-- Name: task_templates_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_organization_id_idx ON public.task_templates USING btree (organization_id);


--
-- Name: tasks_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_archived_at_idx ON public.tasks USING btree (archived_at);


--
-- Name: tasks_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_organization_id_idx ON public.tasks USING btree (organization_id);


--
-- Name: tasks_template_user_shift_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tasks_template_user_shift_uniq ON public.tasks USING btree (template_id, assignee_user_id, shift_id) WHERE ((template_id IS NOT NULL) AND (assignee_user_id IS NOT NULL));


--
-- Name: time_audit_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_audit_organization_id_idx ON public.time_audit USING btree (organization_id);


--
-- Name: time_corrections_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_corrections_archived_at_idx ON public.time_corrections USING btree (archived_at);


--
-- Name: time_corrections_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_corrections_organization_id_idx ON public.time_corrections USING btree (organization_id);


--
-- Name: time_off_requests_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_off_requests_archived_at_idx ON public.time_off_requests USING btree (archived_at);


--
-- Name: time_off_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_off_requests_organization_id_idx ON public.time_off_requests USING btree (organization_id);


--
-- Name: time_punches_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_punches_archived_at_idx ON public.time_punches USING btree (archived_at);


--
-- Name: time_punches_emp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_punches_emp_idx ON public.time_punches USING btree (employee_id, clock_in_at DESC);


--
-- Name: time_punches_one_open_per_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX time_punches_one_open_per_employee ON public.time_punches USING btree (employee_id) WHERE (status = 'open'::public.punch_status);


--
-- Name: time_punches_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_punches_organization_id_idx ON public.time_punches USING btree (organization_id);


--
-- Name: time_punches_trailer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_punches_trailer_idx ON public.time_punches USING btree (trailer_id, clock_in_at DESC);


--
-- Name: trailers_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trailers_organization_id_idx ON public.trailers USING btree (organization_id);


--
-- Name: trusted_clock_devices_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trusted_clock_devices_organization_id_idx ON public.trusted_clock_devices USING btree (organization_id);


--
-- Name: user_roles_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_roles_organization_id_idx ON public.user_roles USING btree (organization_id);


--
-- Name: waste_log_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waste_log_archived_at_idx ON public.waste_log USING btree (archived_at);


--
-- Name: waste_log_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waste_log_organization_id_idx ON public.waste_log USING btree (organization_id);


--
-- Name: weekly_rollup_runs_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX weekly_rollup_runs_week_idx ON public.weekly_rollup_runs USING btree (week_start);


--
-- Name: alerts alerts_dispatch_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER alerts_dispatch_email AFTER INSERT ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.notify_alert_email();


--
-- Name: automation_settings automation_settings_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER automation_settings_updated BEFORE UPDATE ON public.automation_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: checklist_sessions checklist_sessions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER checklist_sessions_updated BEFORE UPDATE ON public.checklist_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: time_punches enforce_clock_in_geofence_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_clock_in_geofence_trg BEFORE INSERT ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.enforce_clock_in_geofence();


--
-- Name: access_log enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.access_log FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: active_location_grants enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.active_location_grants FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: alert_actions enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.alert_actions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: alert_category_reads enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.alert_category_reads FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: alerts enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: audit_log enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: automation_settings enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.automation_settings FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: availability_blocks enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.availability_blocks FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: cash_drawer_sessions enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.cash_drawer_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: cash_drawers enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.cash_drawers FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: cash_drops enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.cash_drops FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: change_log enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.change_log FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: checklist_sessions enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.checklist_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: daily_recaps enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.daily_recaps FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: employee_pins enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.employee_pins FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: handbook_acknowledgements enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.handbook_acknowledgements FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: handbook_sections enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.handbook_sections FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: hospitality_incidents enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.hospitality_incidents FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: hr_document_assignments enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.hr_document_assignments FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: hr_document_signatures enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.hr_document_signatures FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: hr_document_template_versions enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.hr_document_template_versions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: hr_document_templates enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.hr_document_templates FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_categories enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_change_requests enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.inventory_change_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_counts enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.inventory_counts FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_items enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_order_items enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.inventory_order_items FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_orders enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.inventory_orders FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_receipts enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.inventory_receipts FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: invite_codes enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.invite_codes FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: location_access_requests enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.location_access_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: maintenance_requests enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: prep_log enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.prep_log FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: role_email_policies enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.role_email_policies FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: rollover_runs enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.rollover_runs FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: schedule_shifts enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.schedule_shifts FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: schedules enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: shift_claim_requests enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.shift_claim_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: shift_notes enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.shift_notes FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: shift_swap_requests enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.shift_swap_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: shift_templates enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.shift_templates FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: shifts enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: sop_acknowledgements enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.sop_acknowledgements FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: sop_attachments enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.sop_attachments FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: sop_versions enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.sop_versions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: sop_views enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.sop_views FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: sops enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.sops FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: stores enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.stores FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: tab_permissions enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.tab_permissions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: task_template_versions enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.task_template_versions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: task_templates enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.task_templates FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: tasks enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: time_audit enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.time_audit FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: time_corrections enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.time_corrections FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: time_off_requests enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: time_punches enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: trailers enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.trailers FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: trusted_clock_devices enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.trusted_clock_devices FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: user_roles enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: waste_log enforce_org_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_org_id BEFORE INSERT ON public.waste_log FOR EACH ROW EXECUTE FUNCTION public.enforce_org_id();


--
-- Name: inventory_change_requests inventory_change_requests_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_change_requests_updated BEFORE UPDATE ON public.inventory_change_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: inventory_items inventory_items_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: location_access_requests location_access_requests_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER location_access_requests_updated BEFORE UPDATE ON public.location_access_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: maintenance_requests maintenance_requests_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER maintenance_requests_updated BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: notification_preferences notification_preferences_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notification_preferences_touch BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: profiles profiles_self_update_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_self_update_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_self_update_guard();


--
-- Name: profiles profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: schedule_shifts schedule_shifts_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER schedule_shifts_touch BEFORE UPDATE ON public.schedule_shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: schedules schedules_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER schedules_touch BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sops sops_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sops_updated BEFORE UPDATE ON public.sops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: task_templates task_templates_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_templates_touch_updated_at BEFORE UPDATE ON public.task_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: time_corrections time_corrections_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER time_corrections_touch BEFORE UPDATE ON public.time_corrections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: time_off_requests time_off_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER time_off_touch BEFORE UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: time_punches time_punches_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER time_punches_audit AFTER UPDATE ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.audit_punch_change();


--
-- Name: time_punches time_punches_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER time_punches_touch BEFORE UPDATE ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: employee_pins touch_employee_pins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_employee_pins BEFORE UPDATE ON public.employee_pins FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: trusted_clock_devices touch_trusted_devices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_trusted_devices BEFORE UPDATE ON public.trusted_clock_devices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: alerts trg_alerts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: cash_drawers trg_cash_drawers_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cash_drawers_touch BEFORE UPDATE ON public.cash_drawers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: cash_drawer_sessions trg_cash_sessions_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cash_sessions_touch BEFORE UPDATE ON public.cash_drawer_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: hr_document_signatures trg_check_hr_assignment_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_hr_assignment_complete AFTER UPDATE OF signed_at ON public.hr_document_signatures FOR EACH ROW EXECUTE FUNCTION public.check_hr_assignment_complete();


--
-- Name: checklist_sessions trg_checklist_session_failure; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_checklist_session_failure AFTER UPDATE OF end_at ON public.checklist_sessions FOR EACH ROW EXECUTE FUNCTION public.emit_checklist_failure_alert();


--
-- Name: daily_recaps trg_daily_recaps_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_daily_recaps_touch BEFORE UPDATE ON public.daily_recaps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: cash_drawer_sessions trg_emit_cash_drawer_close_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_emit_cash_drawer_close_alert AFTER UPDATE ON public.cash_drawer_sessions FOR EACH ROW EXECUTE FUNCTION public.emit_cash_drawer_close_alert();


--
-- Name: inventory_order_items trg_emit_inv_alert_after_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_emit_inv_alert_after_items AFTER INSERT ON public.inventory_order_items FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_order_alert_after_items();


--
-- Name: inventory_orders trg_emit_inventory_order_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_emit_inventory_order_alert BEFORE UPDATE ON public.inventory_orders FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_order_alert();


--
-- Name: daily_recaps trg_emit_recap_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_emit_recap_alert BEFORE UPDATE ON public.daily_recaps FOR EACH ROW EXECUTE FUNCTION public.emit_recap_alert();


--
-- Name: schedules trg_emit_schedule_published_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_emit_schedule_published_alert BEFORE UPDATE OF status ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.emit_schedule_published_alert();


--
-- Name: schedules trg_emit_schedule_submitted_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_emit_schedule_submitted_alert AFTER UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.emit_schedule_submitted_alert();


--
-- Name: hr_document_assignments trg_explode_hr_signatures; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_explode_hr_signatures AFTER INSERT ON public.hr_document_assignments FOR EACH ROW EXECUTE FUNCTION public.explode_hr_signature_rows();


--
-- Name: time_corrections trg_fill_corr_trailer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_corr_trailer BEFORE INSERT OR UPDATE ON public.time_corrections FOR EACH ROW EXECUTE FUNCTION public.fill_employee_trailer();


--
-- Name: shift_notes trg_fill_note_trailer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_note_trailer BEFORE INSERT OR UPDATE ON public.shift_notes FOR EACH ROW EXECUTE FUNCTION public.fill_employee_trailer();


--
-- Name: schedule_shifts trg_fill_schedule_shift_trailer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_schedule_shift_trailer BEFORE INSERT OR UPDATE ON public.schedule_shifts FOR EACH ROW EXECUTE FUNCTION public.fill_schedule_shift_trailer();


--
-- Name: time_punches trg_fill_time_punch_trailer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_time_punch_trailer BEFORE INSERT OR UPDATE ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.fill_time_punch_trailer();


--
-- Name: time_off_requests trg_fill_to_trailer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_to_trailer BEFORE INSERT OR UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION public.fill_employee_trailer();


--
-- Name: hospitality_incidents trg_hospitality_incident_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hospitality_incident_alert AFTER INSERT ON public.hospitality_incidents FOR EACH ROW EXECUTE FUNCTION public.emit_hospitality_incident_alert();


--
-- Name: hr_document_assignments trg_hr_assignment_update_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hr_assignment_update_guard BEFORE UPDATE ON public.hr_document_assignments FOR EACH ROW EXECUTE FUNCTION public.hr_assignment_update_guard();


--
-- Name: inventory_orders trg_inv_order_insert_normalize; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inv_order_insert_normalize BEFORE INSERT ON public.inventory_orders FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_order_alert_insert();


--
-- Name: inventory_orders trg_inv_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inv_orders_updated BEFORE UPDATE ON public.inventory_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: inventory_items trg_inventory_threshold_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_threshold_alert AFTER INSERT OR UPDATE OF current_qty ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_threshold_alert();


--
-- Name: cash_drops trg_large_cash_drop_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_large_cash_drop_alert AFTER INSERT ON public.cash_drops FOR EACH ROW EXECUTE FUNCTION public.emit_large_cash_drop_alert();


--
-- Name: time_punches trg_link_time_punch_to_shift; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_link_time_punch_to_shift BEFORE INSERT OR UPDATE OF clock_in_at, trailer_id, schedule_shift_id, archived_at ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.link_time_punch_to_shift();


--
-- Name: maintenance_requests trg_maintenance_request_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_maintenance_request_alert AFTER INSERT ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.emit_maintenance_alert();


--
-- Name: alerts trg_notify_alert_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_alert_email AFTER INSERT ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.notify_alert_email();


--
-- Name: profiles trg_profile_milestone_alert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profile_milestone_alert AFTER UPDATE OF sop_accepted_at, training_completed_at, handbook_acknowledged_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.emit_profile_milestone_alert();


--
-- Name: time_punches trg_resolve_time_alerts_from_punch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_resolve_time_alerts_from_punch AFTER INSERT OR UPDATE OF clock_in_at, clock_out_at, status, schedule_shift_id, archived_at ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.resolve_time_alerts_from_punch();


--
-- Name: role_email_policies trg_role_email_policies_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_role_email_policies_touch BEFORE UPDATE ON public.role_email_policies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: task_templates trg_task_template_versions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_task_template_versions AFTER INSERT OR DELETE OR UPDATE ON public.task_templates FOR EACH ROW EXECUTE FUNCTION public.log_task_template_version();


--
-- Name: time_punches trg_time_punch_missed_clock_out; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_time_punch_missed_clock_out AFTER UPDATE OF status ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.emit_missed_clock_out_alert();


--
-- Name: access_log access_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: active_location_grants active_location_grants_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_location_grants
    ADD CONSTRAINT active_location_grants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: active_location_grants active_location_grants_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_location_grants
    ADD CONSTRAINT active_location_grants_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.location_access_requests(id) ON DELETE CASCADE;


--
-- Name: alert_actions alert_actions_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_actions
    ADD CONSTRAINT alert_actions_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON DELETE CASCADE;


--
-- Name: alert_actions alert_actions_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_actions
    ADD CONSTRAINT alert_actions_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: alert_actions alert_actions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_actions
    ADD CONSTRAINT alert_actions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: alert_category_reads alert_category_reads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_category_reads
    ADD CONSTRAINT alert_category_reads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: alerts alerts_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);


--
-- Name: audit_log audit_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: automation_settings automation_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_settings
    ADD CONSTRAINT automation_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: availability_blocks availability_blocks_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: availability_blocks availability_blocks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: availability_blocks availability_blocks_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE SET NULL;


--
-- Name: availability_blocks availability_blocks_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE SET NULL;


--
-- Name: availability_blocks availability_blocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cash_drawer_sessions cash_drawer_sessions_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_sessions
    ADD CONSTRAINT cash_drawer_sessions_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: cash_drawer_sessions cash_drawer_sessions_drawer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_sessions
    ADD CONSTRAINT cash_drawer_sessions_drawer_id_fkey FOREIGN KEY (drawer_id) REFERENCES public.cash_drawers(id) ON DELETE CASCADE;


--
-- Name: cash_drawer_sessions cash_drawer_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_sessions
    ADD CONSTRAINT cash_drawer_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: cash_drawers cash_drawers_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawers
    ADD CONSTRAINT cash_drawers_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: cash_drawers cash_drawers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawers
    ADD CONSTRAINT cash_drawers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: cash_drops cash_drops_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drops
    ADD CONSTRAINT cash_drops_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: cash_drops cash_drops_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drops
    ADD CONSTRAINT cash_drops_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: cash_drops cash_drops_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drops
    ADD CONSTRAINT cash_drops_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.cash_drawer_sessions(id) ON DELETE CASCADE;


--
-- Name: change_log change_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log
    ADD CONSTRAINT change_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: checklist_sessions checklist_sessions_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_sessions
    ADD CONSTRAINT checklist_sessions_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: checklist_sessions checklist_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_sessions
    ADD CONSTRAINT checklist_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: daily_recaps daily_recaps_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_recaps
    ADD CONSTRAINT daily_recaps_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: daily_recaps daily_recaps_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_recaps
    ADD CONSTRAINT daily_recaps_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: email_send_log email_send_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: employee_pins employee_pins_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_pins
    ADD CONSTRAINT employee_pins_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: employee_pins employee_pins_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_pins
    ADD CONSTRAINT employee_pins_set_by_fkey FOREIGN KEY (set_by) REFERENCES auth.users(id);


--
-- Name: employee_pins employee_pins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_pins
    ADD CONSTRAINT employee_pins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: handbook_acknowledgements handbook_acknowledgements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_acknowledgements
    ADD CONSTRAINT handbook_acknowledgements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: handbook_sections handbook_sections_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handbook_sections
    ADD CONSTRAINT handbook_sections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: hospitality_incidents hospitality_incidents_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitality_incidents
    ADD CONSTRAINT hospitality_incidents_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: hospitality_incidents hospitality_incidents_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitality_incidents
    ADD CONSTRAINT hospitality_incidents_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES auth.users(id);


--
-- Name: hospitality_incidents hospitality_incidents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitality_incidents
    ADD CONSTRAINT hospitality_incidents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: hospitality_incidents hospitality_incidents_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitality_incidents
    ADD CONSTRAINT hospitality_incidents_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;


--
-- Name: hr_document_assignments hr_document_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_assignments
    ADD CONSTRAINT hr_document_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: hr_document_assignments hr_document_assignments_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_assignments
    ADD CONSTRAINT hr_document_assignments_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.hr_document_templates(id) ON DELETE SET NULL;


--
-- Name: hr_document_signatures hr_document_signatures_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_signatures
    ADD CONSTRAINT hr_document_signatures_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.hr_document_assignments(id) ON DELETE CASCADE;


--
-- Name: hr_document_signatures hr_document_signatures_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_signatures
    ADD CONSTRAINT hr_document_signatures_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: hr_document_template_versions hr_document_template_versions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_template_versions
    ADD CONSTRAINT hr_document_template_versions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: hr_document_template_versions hr_document_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_template_versions
    ADD CONSTRAINT hr_document_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.hr_document_templates(id) ON DELETE CASCADE;


--
-- Name: hr_document_templates hr_document_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_templates
    ADD CONSTRAINT hr_document_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_categories inventory_categories_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inventory_categories inventory_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inventory_categories inventory_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_change_requests inventory_change_requests_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_change_requests
    ADD CONSTRAINT inventory_change_requests_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: inventory_change_requests inventory_change_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_change_requests
    ADD CONSTRAINT inventory_change_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_counts inventory_counts_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: inventory_counts inventory_counts_counted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES auth.users(id);


--
-- Name: inventory_counts inventory_counts_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_counts inventory_counts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_counts inventory_counts_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_items inventory_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: inventory_order_items inventory_order_items_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_order_items
    ADD CONSTRAINT inventory_order_items_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: inventory_order_items inventory_order_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_order_items
    ADD CONSTRAINT inventory_order_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: inventory_order_items inventory_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_order_items
    ADD CONSTRAINT inventory_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.inventory_orders(id) ON DELETE CASCADE;


--
-- Name: inventory_order_items inventory_order_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_order_items
    ADD CONSTRAINT inventory_order_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_orders inventory_orders_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_orders
    ADD CONSTRAINT inventory_orders_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: inventory_orders inventory_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_orders
    ADD CONSTRAINT inventory_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_receipts inventory_receipts_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: inventory_receipts inventory_receipts_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_receipts inventory_receipts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: inventory_receipts inventory_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id);


--
-- Name: invite_codes invite_codes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: invite_codes invite_codes_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id);


--
-- Name: location_access_requests location_access_requests_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_access_requests
    ADD CONSTRAINT location_access_requests_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: location_access_requests location_access_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_access_requests
    ADD CONSTRAINT location_access_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: maintenance_requests maintenance_requests_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: maintenance_requests maintenance_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: maintenance_requests maintenance_requests_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id);


--
-- Name: maintenance_requests maintenance_requests_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);


--
-- Name: maintenance_requests maintenance_requests_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE SET NULL;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prep_log prep_log_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prep_log
    ADD CONSTRAINT prep_log_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.profiles(id);


--
-- Name: prep_log prep_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prep_log
    ADD CONSTRAINT prep_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: prep_log prep_log_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prep_log
    ADD CONSTRAINT prep_log_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: prep_log prep_log_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prep_log
    ADD CONSTRAINT prep_log_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id);


--
-- Name: profiles profiles_active_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_active_organization_id_fkey FOREIGN KEY (active_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id);


--
-- Name: role_email_policies role_email_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_email_policies
    ADD CONSTRAINT role_email_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: rollover_runs rollover_runs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rollover_runs
    ADD CONSTRAINT rollover_runs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: schedule_shifts schedule_shifts_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_shifts
    ADD CONSTRAINT schedule_shifts_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: schedule_shifts schedule_shifts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_shifts
    ADD CONSTRAINT schedule_shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: schedule_shifts schedule_shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_shifts
    ADD CONSTRAINT schedule_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: schedule_shifts schedule_shifts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_shifts
    ADD CONSTRAINT schedule_shifts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: schedule_shifts schedule_shifts_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_shifts
    ADD CONSTRAINT schedule_shifts_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE;


--
-- Name: schedule_shifts schedule_shifts_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_shifts
    ADD CONSTRAINT schedule_shifts_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE SET NULL;


--
-- Name: schedules schedules_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: schedules schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: schedules schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: schedules schedules_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE SET NULL;


--
-- Name: shift_claim_requests shift_claim_requests_claimant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_claim_requests
    ADD CONSTRAINT shift_claim_requests_claimant_id_fkey FOREIGN KEY (claimant_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shift_claim_requests shift_claim_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_claim_requests
    ADD CONSTRAINT shift_claim_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id);


--
-- Name: shift_claim_requests shift_claim_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_claim_requests
    ADD CONSTRAINT shift_claim_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: shift_claim_requests shift_claim_requests_schedule_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_claim_requests
    ADD CONSTRAINT shift_claim_requests_schedule_shift_id_fkey FOREIGN KEY (schedule_shift_id) REFERENCES public.schedule_shifts(id) ON DELETE CASCADE;


--
-- Name: shift_claim_requests shift_claim_requests_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_claim_requests
    ADD CONSTRAINT shift_claim_requests_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id);


--
-- Name: shift_notes shift_notes_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_notes
    ADD CONSTRAINT shift_notes_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: shift_notes shift_notes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_notes
    ADD CONSTRAINT shift_notes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: shift_swap_requests shift_swap_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);


--
-- Name: shift_swap_requests shift_swap_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: shift_swap_requests shift_swap_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id);


--
-- Name: shift_swap_requests shift_swap_requests_schedule_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_schedule_shift_id_fkey FOREIGN KEY (schedule_shift_id) REFERENCES public.schedule_shifts(id);


--
-- Name: shift_swap_requests shift_swap_requests_target_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_target_employee_id_fkey FOREIGN KEY (target_employee_id) REFERENCES public.profiles(id);


--
-- Name: shift_swap_requests shift_swap_requests_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id);


--
-- Name: shift_templates shift_templates_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: shift_templates shift_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: shift_templates shift_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: shift_templates shift_templates_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE SET NULL;


--
-- Name: shifts shifts_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: shifts shifts_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id);


--
-- Name: shifts shifts_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES auth.users(id);


--
-- Name: shifts shifts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: shifts shifts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: sop_acknowledgements sop_acknowledgements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_acknowledgements
    ADD CONSTRAINT sop_acknowledgements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: sop_acknowledgements sop_acknowledgements_sop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_acknowledgements
    ADD CONSTRAINT sop_acknowledgements_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id) ON DELETE CASCADE;


--
-- Name: sop_attachments sop_attachments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_attachments
    ADD CONSTRAINT sop_attachments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: sop_attachments sop_attachments_sop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_attachments
    ADD CONSTRAINT sop_attachments_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id) ON DELETE CASCADE;


--
-- Name: sop_versions sop_versions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_versions
    ADD CONSTRAINT sop_versions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: sop_versions sop_versions_sop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_versions
    ADD CONSTRAINT sop_versions_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id) ON DELETE CASCADE;


--
-- Name: sop_views sop_views_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_views
    ADD CONSTRAINT sop_views_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: sop_views sop_views_sop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sop_views
    ADD CONSTRAINT sop_views_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id) ON DELETE CASCADE;


--
-- Name: sops sops_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sops
    ADD CONSTRAINT sops_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sops sops_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sops
    ADD CONSTRAINT sops_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: stores stores_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: stores stores_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: tab_permissions tab_permissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tab_permissions
    ADD CONSTRAINT tab_permissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: task_template_versions task_template_versions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_template_versions
    ADD CONSTRAINT task_template_versions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: task_templates task_templates_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: task_templates task_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: task_templates task_templates_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: tasks tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: tasks tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: tasks tasks_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_signed_off_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_signed_off_by_fkey FOREIGN KEY (signed_off_by) REFERENCES auth.users(id);


--
-- Name: tasks tasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.task_templates(id) ON DELETE SET NULL;


--
-- Name: time_audit time_audit_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_audit
    ADD CONSTRAINT time_audit_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: time_corrections time_corrections_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_corrections
    ADD CONSTRAINT time_corrections_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: time_corrections time_corrections_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_corrections
    ADD CONSTRAINT time_corrections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: time_off_requests time_off_requests_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_off_requests
    ADD CONSTRAINT time_off_requests_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: time_off_requests time_off_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_off_requests
    ADD CONSTRAINT time_off_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: time_punches time_punches_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_punches
    ADD CONSTRAINT time_punches_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: time_punches time_punches_clock_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_punches
    ADD CONSTRAINT time_punches_clock_device_id_fkey FOREIGN KEY (clock_device_id) REFERENCES public.trusted_clock_devices(id);


--
-- Name: time_punches time_punches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_punches
    ADD CONSTRAINT time_punches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: time_punches time_punches_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_punches
    ADD CONSTRAINT time_punches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: trailers trailers_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trailers
    ADD CONSTRAINT trailers_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: trailers trailers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trailers
    ADD CONSTRAINT trailers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: trusted_clock_devices trusted_clock_devices_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_clock_devices
    ADD CONSTRAINT trusted_clock_devices_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: trusted_clock_devices trusted_clock_devices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_clock_devices
    ADD CONSTRAINT trusted_clock_devices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: trusted_clock_devices trusted_clock_devices_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_clock_devices
    ADD CONSTRAINT trusted_clock_devices_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id);


--
-- Name: trusted_clock_devices trusted_clock_devices_trailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_clock_devices
    ADD CONSTRAINT trusted_clock_devices_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES public.trailers(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: waste_log waste_log_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_log
    ADD CONSTRAINT waste_log_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES auth.users(id);


--
-- Name: waste_log waste_log_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_log
    ADD CONSTRAINT waste_log_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: waste_log waste_log_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_log
    ADD CONSTRAINT waste_log_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES auth.users(id);


--
-- Name: waste_log waste_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste_log
    ADD CONSTRAINT waste_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;


--
-- Name: email_send_log Service role can insert send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: suppressed_emails Service role can insert suppressed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can insert tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_send_state Service role can manage send state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage send state" ON public.email_send_state USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can mark tokens as used; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_send_log Service role can read send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: suppressed_emails Service role can read suppressed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can read tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: email_send_log Service role can update send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: _org_resolution; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._org_resolution ENABLE ROW LEVEL SECURITY;

--
-- Name: access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: access_log access_log_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_log_org_delete ON public.access_log FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: access_log access_log_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_log_org_insert ON public.access_log FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: access_log access_log_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_log_org_select ON public.access_log FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: access_log access_log_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_log_org_update ON public.access_log FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: active_location_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.active_location_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: active_location_grants active_location_grants_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY active_location_grants_org_delete ON public.active_location_grants FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: active_location_grants active_location_grants_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY active_location_grants_org_insert ON public.active_location_grants FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: active_location_grants active_location_grants_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY active_location_grants_org_select ON public.active_location_grants FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: active_location_grants active_location_grants_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY active_location_grants_org_update ON public.active_location_grants FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_actions alert_actions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_actions_org_delete ON public.alert_actions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_actions alert_actions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_actions_org_insert ON public.alert_actions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_actions alert_actions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_actions_org_select ON public.alert_actions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_actions alert_actions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_actions_org_update ON public.alert_actions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_category_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_category_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_category_reads alert_category_reads_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_category_reads_org_delete ON public.alert_category_reads FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_category_reads alert_category_reads_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_category_reads_org_insert ON public.alert_category_reads FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_category_reads alert_category_reads_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_category_reads_org_select ON public.alert_category_reads FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alert_category_reads alert_category_reads_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_category_reads_org_update ON public.alert_category_reads FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts alerts_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_org_delete ON public.alerts FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alerts alerts_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_org_insert ON public.alerts FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alerts alerts_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_org_select ON public.alerts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: alerts alerts_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_org_update ON public.alerts FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_org_delete ON public.audit_log FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: audit_log audit_log_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_org_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: audit_log audit_log_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_org_select ON public.audit_log FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: audit_log audit_log_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_org_update ON public.audit_log FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: automation_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_settings automation_settings_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_settings_org_delete ON public.automation_settings FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: automation_settings automation_settings_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_settings_org_insert ON public.automation_settings FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: automation_settings automation_settings_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_settings_org_select ON public.automation_settings FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: automation_settings automation_settings_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_settings_org_update ON public.automation_settings FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: availability_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_blocks availability_blocks_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blocks_org_delete ON public.availability_blocks FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: availability_blocks availability_blocks_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blocks_org_insert ON public.availability_blocks FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: availability_blocks availability_blocks_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blocks_org_select ON public.availability_blocks FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: availability_blocks availability_blocks_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blocks_org_update ON public.availability_blocks FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawer_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_drawer_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_drawer_sessions cash_drawer_sessions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawer_sessions_org_delete ON public.cash_drawer_sessions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawer_sessions cash_drawer_sessions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawer_sessions_org_insert ON public.cash_drawer_sessions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawer_sessions cash_drawer_sessions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawer_sessions_org_select ON public.cash_drawer_sessions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawer_sessions cash_drawer_sessions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawer_sessions_org_update ON public.cash_drawer_sessions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_drawers ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_drawers cash_drawers_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawers_org_delete ON public.cash_drawers FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawers cash_drawers_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawers_org_insert ON public.cash_drawers FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawers cash_drawers_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawers_org_select ON public.cash_drawers FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drawers cash_drawers_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drawers_org_update ON public.cash_drawers FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_drops ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_drops cash_drops_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drops_org_delete ON public.cash_drops FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drops cash_drops_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drops_org_insert ON public.cash_drops FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drops cash_drops_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drops_org_select ON public.cash_drops FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cash_drops cash_drops_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_drops_org_update ON public.cash_drops FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: change_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

--
-- Name: change_log change_log_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_log_org_delete ON public.change_log FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: change_log change_log_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_log_org_insert ON public.change_log FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: change_log change_log_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_log_org_select ON public.change_log FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: change_log change_log_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY change_log_org_update ON public.change_log FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: checklist_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_sessions checklist_sessions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_sessions_org_delete ON public.checklist_sessions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: checklist_sessions checklist_sessions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_sessions_org_insert ON public.checklist_sessions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: checklist_sessions checklist_sessions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_sessions_org_select ON public.checklist_sessions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: checklist_sessions checklist_sessions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_sessions_org_update ON public.checklist_sessions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: cron_dispatch_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_dispatch_config ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_recaps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_recaps ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_recaps daily_recaps_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_recaps_org_delete ON public.daily_recaps FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: daily_recaps daily_recaps_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_recaps_org_insert ON public.daily_recaps FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: daily_recaps daily_recaps_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_recaps_org_select ON public.daily_recaps FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: daily_recaps daily_recaps_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_recaps_org_update ON public.daily_recaps FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: email_dispatch_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_dispatch_config ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

--
-- Name: email_unsubscribe_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_pins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_pins ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_pins employee_pins_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_pins_org_delete ON public.employee_pins FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: employee_pins employee_pins_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_pins_org_insert ON public.employee_pins FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: employee_pins employee_pins_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_pins_org_select ON public.employee_pins FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: employee_pins employee_pins_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_pins_org_update ON public.employee_pins FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_acknowledgements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handbook_acknowledgements ENABLE ROW LEVEL SECURITY;

--
-- Name: handbook_acknowledgements handbook_acknowledgements_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_acknowledgements_org_delete ON public.handbook_acknowledgements FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_acknowledgements handbook_acknowledgements_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_acknowledgements_org_insert ON public.handbook_acknowledgements FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_acknowledgements handbook_acknowledgements_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_acknowledgements_org_select ON public.handbook_acknowledgements FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_acknowledgements handbook_acknowledgements_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_acknowledgements_org_update ON public.handbook_acknowledgements FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handbook_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: handbook_sections handbook_sections_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_sections_org_delete ON public.handbook_sections FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_sections handbook_sections_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_sections_org_insert ON public.handbook_sections FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_sections handbook_sections_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_sections_org_select ON public.handbook_sections FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: handbook_sections handbook_sections_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY handbook_sections_org_update ON public.handbook_sections FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hospitality_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hospitality_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: hospitality_incidents hospitality_incidents_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hospitality_incidents_org_delete ON public.hospitality_incidents FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hospitality_incidents hospitality_incidents_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hospitality_incidents_org_insert ON public.hospitality_incidents FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hospitality_incidents hospitality_incidents_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hospitality_incidents_org_select ON public.hospitality_incidents FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hospitality_incidents hospitality_incidents_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hospitality_incidents_org_update ON public.hospitality_incidents FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_document_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_document_assignments hr_document_assignments_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_assignments_org_delete ON public.hr_document_assignments FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_assignments hr_document_assignments_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_assignments_org_insert ON public.hr_document_assignments FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_assignments hr_document_assignments_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_assignments_org_select ON public.hr_document_assignments FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_assignments hr_document_assignments_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_assignments_org_update ON public.hr_document_assignments FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_document_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_document_signatures hr_document_signatures_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_signatures_org_delete ON public.hr_document_signatures FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_signatures hr_document_signatures_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_signatures_org_insert ON public.hr_document_signatures FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_signatures hr_document_signatures_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_signatures_org_select ON public.hr_document_signatures FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_signatures hr_document_signatures_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_signatures_org_update ON public.hr_document_signatures FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_template_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_document_template_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_document_template_versions hr_document_template_versions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_template_versions_org_delete ON public.hr_document_template_versions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_template_versions hr_document_template_versions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_template_versions_org_insert ON public.hr_document_template_versions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_template_versions hr_document_template_versions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_template_versions_org_select ON public.hr_document_template_versions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_template_versions hr_document_template_versions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_template_versions_org_update ON public.hr_document_template_versions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_document_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: hr_document_templates hr_document_templates_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_templates_org_delete ON public.hr_document_templates FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_templates hr_document_templates_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_templates_org_insert ON public.hr_document_templates FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_templates hr_document_templates_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_templates_org_select ON public.hr_document_templates FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: hr_document_templates hr_document_templates_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hr_document_templates_org_update ON public.hr_document_templates FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_categories inventory_categories_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_categories_org_delete ON public.inventory_categories FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories inventory_categories_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_categories_org_insert ON public.inventory_categories FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories inventory_categories_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_categories_org_select ON public.inventory_categories FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories inventory_categories_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_categories_org_update ON public.inventory_categories FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_change_requests inventory_change_requests_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_change_requests_org_delete ON public.inventory_change_requests FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_change_requests inventory_change_requests_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_change_requests_org_insert ON public.inventory_change_requests FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_change_requests inventory_change_requests_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_change_requests_org_select ON public.inventory_change_requests FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_change_requests inventory_change_requests_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_change_requests_org_update ON public.inventory_change_requests FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_counts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_counts inventory_counts_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_counts_org_delete ON public.inventory_counts FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_counts inventory_counts_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_counts_org_insert ON public.inventory_counts FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_counts inventory_counts_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_counts_org_select ON public.inventory_counts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_counts inventory_counts_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_counts_org_update ON public.inventory_counts FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items inventory_items_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_org_delete ON public.inventory_items FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items inventory_items_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_org_insert ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items inventory_items_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_org_select ON public.inventory_items FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items inventory_items_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_org_update ON public.inventory_items FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_order_items inventory_order_items_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_order_items_org_delete ON public.inventory_order_items FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_order_items inventory_order_items_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_order_items_org_insert ON public.inventory_order_items FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_order_items inventory_order_items_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_order_items_org_select ON public.inventory_order_items FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_order_items inventory_order_items_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_order_items_org_update ON public.inventory_order_items FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_orders inventory_orders_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_orders_org_delete ON public.inventory_orders FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_orders inventory_orders_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_orders_org_insert ON public.inventory_orders FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_orders inventory_orders_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_orders_org_select ON public.inventory_orders FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_orders inventory_orders_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_orders_org_update ON public.inventory_orders FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_receipts inventory_receipts_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_org_delete ON public.inventory_receipts FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_receipts inventory_receipts_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_org_insert ON public.inventory_receipts FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_receipts inventory_receipts_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_org_select ON public.inventory_receipts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_receipts inventory_receipts_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_org_update ON public.inventory_receipts FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invite_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_codes invite_codes_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invite_codes_org_delete ON public.invite_codes FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invite_codes invite_codes_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invite_codes_org_insert ON public.invite_codes FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invite_codes invite_codes_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invite_codes_org_select ON public.invite_codes FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invite_codes invite_codes_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invite_codes_org_update ON public.invite_codes FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: location_access_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_access_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: location_access_requests location_access_requests_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_access_requests_org_delete ON public.location_access_requests FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: location_access_requests location_access_requests_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_access_requests_org_insert ON public.location_access_requests FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: location_access_requests location_access_requests_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_access_requests_org_select ON public.location_access_requests FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: location_access_requests location_access_requests_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_access_requests_org_update ON public.location_access_requests FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: maintenance_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_requests maintenance_requests_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_requests_org_delete ON public.maintenance_requests FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: maintenance_requests maintenance_requests_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_requests_org_insert ON public.maintenance_requests FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: maintenance_requests maintenance_requests_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_requests_org_select ON public.maintenance_requests FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: maintenance_requests maintenance_requests_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_requests_org_update ON public.maintenance_requests FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations org_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_admin_update ON public.organizations FOR UPDATE TO authenticated USING ((public.has_org_role(auth.uid(), id, 'org_admin'::public.org_role) OR public.has_org_role(auth.uid(), id, 'org_owner'::public.org_role))) WITH CHECK ((public.has_org_role(auth.uid(), id, 'org_admin'::public.org_role) OR public.has_org_role(auth.uid(), id, 'org_owner'::public.org_role)));


--
-- Name: organizations org_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_read_own ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));


--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members orgmem_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orgmem_admin_manage ON public.organization_members TO authenticated USING ((public.has_org_role(auth.uid(), organization_id, 'org_admin'::public.org_role) OR public.has_org_role(auth.uid(), organization_id, 'org_owner'::public.org_role))) WITH CHECK ((public.has_org_role(auth.uid(), organization_id, 'org_admin'::public.org_role) OR public.has_org_role(auth.uid(), organization_id, 'org_owner'::public.org_role)));


--
-- Name: organization_members orgmem_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orgmem_read_own ON public.organization_members FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_org_member(auth.uid(), organization_id)));


--
-- Name: notification_preferences prefs self read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "prefs self read" ON public.notification_preferences FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_manager(auth.uid())));


--
-- Name: prep_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prep_log ENABLE ROW LEVEL SECURITY;

--
-- Name: prep_log prep_log_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prep_log_org_delete ON public.prep_log FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: prep_log prep_log_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prep_log_org_insert ON public.prep_log FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: prep_log prep_log_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prep_log_org_select ON public.prep_log FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: prep_log prep_log_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prep_log_org_update ON public.prep_log FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles edit self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles edit self" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles insert self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles managers edit any; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles managers edit any" ON public.profiles FOR UPDATE TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));


--
-- Name: profiles profiles readable scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles readable scoped" ON public.profiles FOR SELECT USING (((id = auth.uid()) OR public.is_super_admin(auth.uid()) OR (public.is_manager(auth.uid()) AND (NOT (trailer_id IS DISTINCT FROM public.my_trailer_id())))));


--
-- Name: role_email_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_email_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: role_email_policies role_email_policies_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_email_policies_org_delete ON public.role_email_policies FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: role_email_policies role_email_policies_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_email_policies_org_insert ON public.role_email_policies FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: role_email_policies role_email_policies_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_email_policies_org_select ON public.role_email_policies FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: role_email_policies role_email_policies_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_email_policies_org_update ON public.role_email_policies FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: rollover_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rollover_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: rollover_runs rollover_runs_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rollover_runs_org_delete ON public.rollover_runs FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: rollover_runs rollover_runs_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rollover_runs_org_insert ON public.rollover_runs FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: rollover_runs rollover_runs_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rollover_runs_org_select ON public.rollover_runs FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: rollover_runs rollover_runs_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rollover_runs_org_update ON public.rollover_runs FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedule_shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_shifts schedule_shifts_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_shifts_org_delete ON public.schedule_shifts FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedule_shifts schedule_shifts_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_shifts_org_insert ON public.schedule_shifts FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedule_shifts schedule_shifts_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_shifts_org_select ON public.schedule_shifts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedule_shifts schedule_shifts_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_shifts_org_update ON public.schedule_shifts FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: schedules schedules_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedules_org_delete ON public.schedules FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedules schedules_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedules_org_insert ON public.schedules FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedules schedules_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedules_org_select ON public.schedules FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: schedules schedules_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedules_org_update ON public.schedules FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_claim_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_claim_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_claim_requests shift_claim_requests_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_claim_requests_org_delete ON public.shift_claim_requests FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_claim_requests shift_claim_requests_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_claim_requests_org_insert ON public.shift_claim_requests FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_claim_requests shift_claim_requests_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_claim_requests_org_select ON public.shift_claim_requests FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_claim_requests shift_claim_requests_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_claim_requests_org_update ON public.shift_claim_requests FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_notes shift_notes_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_notes_org_delete ON public.shift_notes FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_notes shift_notes_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_notes_org_insert ON public.shift_notes FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_notes shift_notes_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_notes_org_select ON public.shift_notes FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_notes shift_notes_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_notes_org_update ON public.shift_notes FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_swap_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_swap_requests shift_swap_requests_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_swap_requests_org_delete ON public.shift_swap_requests FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_swap_requests shift_swap_requests_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_swap_requests_org_insert ON public.shift_swap_requests FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_swap_requests shift_swap_requests_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_swap_requests_org_select ON public.shift_swap_requests FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_swap_requests shift_swap_requests_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_swap_requests_org_update ON public.shift_swap_requests FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_templates shift_templates_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_templates_org_delete ON public.shift_templates FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_templates shift_templates_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_templates_org_insert ON public.shift_templates FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_templates shift_templates_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_templates_org_select ON public.shift_templates FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shift_templates shift_templates_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_templates_org_update ON public.shift_templates FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts shifts_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_org_delete ON public.shifts FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shifts shifts_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_org_insert ON public.shifts FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shifts shifts_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_org_select ON public.shifts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: shifts shifts_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_org_update ON public.shifts FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_acknowledgements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sop_acknowledgements ENABLE ROW LEVEL SECURITY;

--
-- Name: sop_acknowledgements sop_acknowledgements_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_acknowledgements_org_delete ON public.sop_acknowledgements FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_acknowledgements sop_acknowledgements_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_acknowledgements_org_insert ON public.sop_acknowledgements FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_acknowledgements sop_acknowledgements_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_acknowledgements_org_select ON public.sop_acknowledgements FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_acknowledgements sop_acknowledgements_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_acknowledgements_org_update ON public.sop_acknowledgements FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sop_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: sop_attachments sop_attachments_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_attachments_org_delete ON public.sop_attachments FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_attachments sop_attachments_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_attachments_org_insert ON public.sop_attachments FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_attachments sop_attachments_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_attachments_org_select ON public.sop_attachments FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_attachments sop_attachments_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_attachments_org_update ON public.sop_attachments FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sop_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: sop_versions sop_versions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_versions_org_delete ON public.sop_versions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_versions sop_versions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_versions_org_insert ON public.sop_versions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_versions sop_versions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_versions_org_select ON public.sop_versions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_versions sop_versions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_versions_org_update ON public.sop_versions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sop_views ENABLE ROW LEVEL SECURITY;

--
-- Name: sop_views sop_views_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_views_org_delete ON public.sop_views FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_views sop_views_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_views_org_insert ON public.sop_views FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_views sop_views_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_views_org_select ON public.sop_views FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sop_views sop_views_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sop_views_org_update ON public.sop_views FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;

--
-- Name: sops sops_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sops_org_delete ON public.sops FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sops sops_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sops_org_insert ON public.sops FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sops sops_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sops_org_select ON public.sops FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: sops sops_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sops_org_update ON public.sops FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: stores stores_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stores_org_delete ON public.stores FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: stores stores_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stores_org_insert ON public.stores FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: stores stores_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stores_org_select ON public.stores FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: stores stores_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stores_org_update ON public.stores FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: suppressed_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: tab_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tab_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: tab_permissions tab_permissions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tab_permissions_org_delete ON public.tab_permissions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tab_permissions tab_permissions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tab_permissions_org_insert ON public.tab_permissions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tab_permissions tab_permissions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tab_permissions_org_select ON public.tab_permissions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tab_permissions tab_permissions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tab_permissions_org_update ON public.tab_permissions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_template_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_template_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: task_template_versions task_template_versions_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_template_versions_org_delete ON public.task_template_versions FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_template_versions task_template_versions_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_template_versions_org_insert ON public.task_template_versions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_template_versions task_template_versions_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_template_versions_org_select ON public.task_template_versions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_template_versions task_template_versions_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_template_versions_org_update ON public.task_template_versions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: task_templates task_templates_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_templates_org_delete ON public.task_templates FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_templates task_templates_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_templates_org_insert ON public.task_templates FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_templates task_templates_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_templates_org_select ON public.task_templates FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: task_templates task_templates_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_templates_org_update ON public.task_templates FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_delete ON public.tasks FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tasks tasks_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tasks tasks_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_select ON public.tasks FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tasks tasks_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_org_update ON public.tasks FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: time_audit time_audit_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_audit_org_delete ON public.time_audit FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_audit time_audit_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_audit_org_insert ON public.time_audit FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_audit time_audit_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_audit_org_select ON public.time_audit FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_audit time_audit_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_audit_org_update ON public.time_audit FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_corrections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: time_corrections time_corrections_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_corrections_org_delete ON public.time_corrections FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_corrections time_corrections_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_corrections_org_insert ON public.time_corrections FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_corrections time_corrections_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_corrections_org_select ON public.time_corrections FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_corrections time_corrections_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_corrections_org_update ON public.time_corrections FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_off_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: time_off_requests time_off_requests_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_off_requests_org_delete ON public.time_off_requests FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_off_requests time_off_requests_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_off_requests_org_insert ON public.time_off_requests FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_off_requests time_off_requests_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_off_requests_org_select ON public.time_off_requests FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_off_requests time_off_requests_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_off_requests_org_update ON public.time_off_requests FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_punches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_punches ENABLE ROW LEVEL SECURITY;

--
-- Name: time_punches time_punches_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_punches_org_delete ON public.time_punches FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_punches time_punches_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_punches_org_insert ON public.time_punches FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_punches time_punches_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_punches_org_select ON public.time_punches FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: time_punches time_punches_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_punches_org_update ON public.time_punches FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trailers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

--
-- Name: trailers trailers_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trailers_org_delete ON public.trailers FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trailers trailers_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trailers_org_insert ON public.trailers FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trailers trailers_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trailers_org_select ON public.trailers FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trailers trailers_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trailers_org_update ON public.trailers FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trusted_clock_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trusted_clock_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_clock_devices trusted_clock_devices_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trusted_clock_devices_org_delete ON public.trusted_clock_devices FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trusted_clock_devices trusted_clock_devices_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trusted_clock_devices_org_insert ON public.trusted_clock_devices FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trusted_clock_devices trusted_clock_devices_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trusted_clock_devices_org_select ON public.trusted_clock_devices FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: trusted_clock_devices trusted_clock_devices_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trusted_clock_devices_org_update ON public.trusted_clock_devices FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_org_delete ON public.user_roles FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_roles user_roles_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_org_insert ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_roles user_roles_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_org_select ON public.user_roles FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_roles user_roles_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_org_update ON public.user_roles FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: waste_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waste_log ENABLE ROW LEVEL SECURITY;

--
-- Name: waste_log waste_log_org_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waste_log_org_delete ON public.waste_log FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: waste_log waste_log_org_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waste_log_org_insert ON public.waste_log FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: waste_log waste_log_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waste_log_org_select ON public.waste_log FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: waste_log waste_log_org_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waste_log_org_update ON public.waste_log FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: weekly_rollup_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_rollup_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_rollup_runs weekly_rollup_runs read managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "weekly_rollup_runs read managers" ON public.weekly_rollup_runs FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));


--
-- PostgreSQL database dump complete
--


