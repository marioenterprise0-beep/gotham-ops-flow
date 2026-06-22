ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'hr_document';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'hr_document_signed';

ALTER TABLE public.notification_preferences
  ALTER COLUMN categories SET DEFAULT
    '{"schedule":true,"time_clock":true,"inventory":true,"cash":true,"operations":true,"training":true,"announcements":true,"critical":true,"hr_documents":true}'::jsonb;

UPDATE public.notification_preferences
  SET categories = categories || '{"hr_documents": true}'::jsonb
  WHERE NOT (categories ? 'hr_documents');

CREATE OR REPLACE FUNCTION public.check_hr_assignment_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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