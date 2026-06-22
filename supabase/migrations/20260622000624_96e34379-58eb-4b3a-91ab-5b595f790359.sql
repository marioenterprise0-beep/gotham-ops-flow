DROP POLICY IF EXISTS "hr_signatures sign self" ON public.hr_document_signatures;
CREATE POLICY "hr_signatures sign self" ON public.hr_document_signatures FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hr_document_assignments a WHERE a.id = assignment_id
      AND (a.employee_id = auth.uid() OR public.is_manager(auth.uid()))
  ))
  WITH CHECK (
    signer_user_id = auth.uid()
    AND (
      (signer_role_label ~* 'employee' AND EXISTS (
        SELECT 1 FROM public.hr_document_assignments a WHERE a.id = assignment_id AND a.employee_id = auth.uid()
      ))
      OR (signer_role_label ~* 'director of operations' AND public.has_role(auth.uid(), 'owner'))
      OR (signer_role_label !~* 'employee' AND signer_role_label !~* 'director of operations' AND public.is_manager(auth.uid()))
    )
  );