
-- 1) Profiles PII: revoke coworker access to email + pay_rate via column-level GRANTs.
-- Server code that needs these fields already uses the service-role admin client,
-- which bypasses column privileges.
REVOKE SELECT (email, pay_rate) ON public.profiles FROM authenticated;
REVOKE SELECT (email, pay_rate) ON public.profiles FROM anon;

-- Grant back the non-sensitive columns explicitly so remaining client reads keep working.
GRANT SELECT (
  id, display_name, store_id, created_at, updated_at, trailer_id,
  last_login_at, sop_accepted_at, training_completed_at, active,
  archived_at, archived_by, archive_reason, handbook_acknowledged_at,
  is_super_admin, weekly_hours
) ON public.profiles TO authenticated;

-- 2) hr_document_templates: add management policies (SELECT policy already exists).
CREATE POLICY "hr_templates insert managers"
  ON public.hr_document_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "hr_templates update managers"
  ON public.hr_document_templates FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "hr_templates delete owners"
  ON public.hr_document_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));
