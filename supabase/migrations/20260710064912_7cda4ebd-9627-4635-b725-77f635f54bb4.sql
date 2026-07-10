-- Atomic RPCs so availability_blocks writes and their companion alerts
-- commit or roll back together. Callers replace two separate writes with
-- a single SECURITY DEFINER function call.

CREATE OR REPLACE FUNCTION public.request_availability_atomic(
  _block_date date,
  _reason text,
  _requires_approval boolean,
  _trailer_id uuid,
  _schedule_id uuid,
  _schedule_name text,
  _schedule_status text,
  _employee_name text
)
RETURNS public.availability_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_row public.availability_blocks;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_status := CASE WHEN _requires_approval THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.availability_blocks AS ab (
    user_id, block_date, all_day, reason, status,
    trailer_id, schedule_id, decided_by, decided_at, decision_note
  ) VALUES (
    v_uid, _block_date, true, NULLIF(_reason,''), v_status,
    _trailer_id, _schedule_id, NULL, NULL, NULL
  )
  ON CONFLICT (user_id, block_date) DO UPDATE
    SET all_day = EXCLUDED.all_day,
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        trailer_id = EXCLUDED.trailer_id,
        schedule_id = EXCLUDED.schedule_id,
        decided_by = NULL,
        decided_at = NULL,
        decision_note = NULL
  RETURNING * INTO v_row;

  IF _requires_approval THEN
    INSERT INTO public.alerts (
      type, title, description, source_module, source_id,
      trailer_id, created_by, assigned_role, priority, status, payload
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
      )
    );
  END IF;

  RETURN v_row;
END
$fn$;

GRANT EXECUTE ON FUNCTION public.request_availability_atomic(
  date, text, boolean, uuid, uuid, text, text, text
) TO authenticated;


CREATE OR REPLACE FUNCTION public.decide_availability_atomic(
  _id uuid,
  _decision text,
  _note text
)
RETURNS public.availability_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.availability_blocks;
  v_decider_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_manager(v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _decision NOT IN ('approved','declined') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  UPDATE public.availability_blocks
     SET status = _decision,
         decided_by = v_uid,
         decided_at = now(),
         decision_note = NULLIF(_note,'')
   WHERE id = _id
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'availability block not found';
  END IF;

  SELECT display_name INTO v_decider_name FROM public.profiles WHERE id = v_uid;

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
      'decided_by_name', COALESCE(v_decider_name, 'Management')
    )
  );

  RETURN v_row;
END
$fn$;

GRANT EXECUTE ON FUNCTION public.decide_availability_atomic(uuid, text, text) TO authenticated;
