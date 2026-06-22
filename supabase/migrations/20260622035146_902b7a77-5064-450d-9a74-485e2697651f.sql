CREATE OR REPLACE FUNCTION public.hr_assignment_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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