
-- Tighten HR template writes to owners only
DROP POLICY IF EXISTS "hr_templates insert managers" ON public.hr_document_templates;
DROP POLICY IF EXISTS "hr_templates update managers" ON public.hr_document_templates;

CREATE POLICY "hr_templates insert owners"
  ON public.hr_document_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "hr_templates update owners"
  ON public.hr_document_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

-- Scope stores read: crew see only their own store; managers/owners see all
DROP POLICY IF EXISTS "stores readable to crew" ON public.stores;

CREATE POLICY "stores readable scoped"
  ON public.stores FOR SELECT TO authenticated
  USING (
    public.is_manager(auth.uid())
    OR id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  );
