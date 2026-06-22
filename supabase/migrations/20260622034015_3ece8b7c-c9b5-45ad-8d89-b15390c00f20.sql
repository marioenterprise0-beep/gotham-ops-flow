-- Prevent employees from bypassing the signature flow by PATCHing
-- hr_document_assignments directly. RLS still lets the employee row
-- through, but this BEFORE UPDATE guard restricts which columns/values
-- they may actually change. Manager/owner users and nested trigger
-- contexts (pg_trigger_depth() > 1, e.g. check_hr_assignment_complete)
-- pass through unchanged.

CREATE OR REPLACE FUNCTION public.hr_assignment_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow when invoked from inside another trigger (e.g. the signature
  -- completion trigger flipping status -> 'signed').
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Managers and owners keep full edit rights.
  IF public.is_manager(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- From here on the caller is an ordinary employee. They must own the row.
  IF OLD.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: cannot edit another employee''s assignment';
  END IF;

  -- Status: only the pending -> viewed transition is permitted.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'viewed') THEN
      RAISE EXCEPTION 'forbidden: employees cannot change assignment status';
    END IF;
  END IF;

  -- Sensitive columns must remain unchanged.
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

DROP TRIGGER IF EXISTS trg_hr_assignment_update_guard ON public.hr_document_assignments;
CREATE TRIGGER trg_hr_assignment_update_guard
BEFORE UPDATE ON public.hr_document_assignments
FOR EACH ROW EXECUTE FUNCTION public.hr_assignment_update_guard();
