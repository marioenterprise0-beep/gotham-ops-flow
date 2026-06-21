-- HR document template library + per-employee assignments + multi-signer tracking.

CREATE TYPE public.hr_doc_category AS ENUM ('onboarding','training','hr','operations');
CREATE TYPE public.hr_assignment_status AS ENUM ('pending','viewed','signed','voided');

CREATE TABLE public.hr_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_code text NOT NULL UNIQUE,
  category public.hr_doc_category NOT NULL,
  title text NOT NULL,
  body_blocks jsonb NOT NULL,
  signer_roles text[] NOT NULL DEFAULT '{}',
  owner_only boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hr_templates_category_idx ON public.hr_document_templates(category);

GRANT SELECT ON public.hr_document_templates TO authenticated;
GRANT ALL ON public.hr_document_templates TO service_role;
ALTER TABLE public.hr_document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_templates read scoped" ON public.hr_document_templates FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'owner')
    OR (public.is_manager(auth.uid()) AND NOT owner_only)
  );

CREATE TABLE public.hr_document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.hr_document_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  body_blocks jsonb NOT NULL,
  signer_roles text[] NOT NULL,
  edited_by uuid,
  edited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hr_template_versions_template_idx ON public.hr_document_template_versions(template_id);

GRANT SELECT, INSERT ON public.hr_document_template_versions TO authenticated;
GRANT ALL ON public.hr_document_template_versions TO service_role;
ALTER TABLE public.hr_document_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_template_versions read managers" ON public.hr_document_template_versions FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()));

CREATE TABLE public.hr_document_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  template_id uuid REFERENCES public.hr_document_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  body_blocks jsonb,
  custom_storage_path text,
  custom_content_type text,
  required_signer_roles text[] NOT NULL DEFAULT '{}',
  status public.hr_assignment_status NOT NULL DEFAULT 'pending',
  assigned_by uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  viewed_at timestamptz,
  completed_at timestamptz,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  trailer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hr_assignments_employee_idx ON public.hr_document_assignments(employee_id, status);
CREATE INDEX hr_assignments_assigned_by_idx ON public.hr_document_assignments(assigned_by);

GRANT SELECT, INSERT, UPDATE ON public.hr_document_assignments TO authenticated;
GRANT ALL ON public.hr_document_assignments TO service_role;
ALTER TABLE public.hr_document_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_assignments read" ON public.hr_document_assignments FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_manager(auth.uid()));
CREATE POLICY "hr_assignments insert mgr" ON public.hr_document_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(auth.uid()) AND assigned_by = auth.uid());
CREATE POLICY "hr_assignments update" ON public.hr_document_assignments FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR public.is_manager(auth.uid()))
  WITH CHECK (employee_id = auth.uid() OR public.is_manager(auth.uid()));

CREATE TABLE public.hr_document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.hr_document_assignments(id) ON DELETE CASCADE,
  signer_role_label text NOT NULL,
  signer_user_id uuid,
  typed_full_name text,
  signed_at timestamptz,
  UNIQUE (assignment_id, signer_role_label)
);
CREATE INDEX hr_signatures_assignment_idx ON public.hr_document_signatures(assignment_id);

GRANT SELECT, INSERT, UPDATE ON public.hr_document_signatures TO authenticated;
GRANT ALL ON public.hr_document_signatures TO service_role;
ALTER TABLE public.hr_document_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_signatures read via assignment" ON public.hr_document_signatures FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hr_document_assignments a WHERE a.id = assignment_id
      AND (a.employee_id = auth.uid() OR public.is_manager(auth.uid()))
  ));
CREATE POLICY "hr_signatures sign self" ON public.hr_document_signatures FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hr_document_assignments a WHERE a.id = assignment_id
      AND (a.employee_id = auth.uid() OR public.is_manager(auth.uid()))
  ))
  WITH CHECK (signer_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.explode_hr_signature_rows()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE role_label text;
BEGIN
  FOREACH role_label IN ARRAY NEW.required_signer_roles LOOP
    INSERT INTO public.hr_document_signatures (assignment_id, signer_role_label)
    VALUES (NEW.id, role_label);
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_explode_hr_signatures ON public.hr_document_assignments;
CREATE TRIGGER trg_explode_hr_signatures
AFTER INSERT ON public.hr_document_assignments
FOR EACH ROW EXECUTE FUNCTION public.explode_hr_signature_rows();

CREATE OR REPLACE FUNCTION public.check_hr_assignment_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining int;
BEGIN
  IF NEW.signed_at IS NOT NULL AND OLD.signed_at IS NULL THEN
    SELECT count(*) INTO remaining FROM public.hr_document_signatures
      WHERE assignment_id = NEW.assignment_id AND signed_at IS NULL;
    IF remaining = 0 THEN
      UPDATE public.hr_document_assignments
        SET status = 'signed', completed_at = now()
        WHERE id = NEW.assignment_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_check_hr_assignment_complete ON public.hr_document_signatures;
CREATE TRIGGER trg_check_hr_assignment_complete
AFTER UPDATE OF signed_at ON public.hr_document_signatures
FOR EACH ROW EXECUTE FUNCTION public.check_hr_assignment_complete();