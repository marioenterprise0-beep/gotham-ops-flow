-- Re-revoke and re-grant SELECT on public.profiles to authenticated, EXCLUDING
-- sensitive columns (pay_rate, archived_by, archive_reason). Migration
-- 20260630193830 accidentally included these in the column-level SELECT grant,
-- which combined with the coworker-visibility RLS policy let any crew member
-- read coworker pay rates and termination details.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, email, store_id, trailer_id, active, last_login_at,
  sop_accepted_at, training_completed_at, handbook_acknowledged_at,
  archived_at, created_at, updated_at, weekly_hours, is_super_admin
) ON public.profiles TO authenticated;