-- Fix 1: Remove `email` and `is_super_admin` from the authenticated column-level SELECT
-- grant on profiles. Coworker-visibility RLS would otherwise let any crew member
-- read coworker emails and discover super-admin accounts.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, display_name, store_id, trailer_id, active, last_login_at,
  sop_accepted_at, training_completed_at, handbook_acknowledged_at,
  archived_at, created_at, updated_at, weekly_hours
) ON public.profiles TO authenticated;

-- Fix 2: Drop the two daily_recaps policies that only check `manager_id = auth.uid()`
-- without verifying the caller is actually a manager. Because RLS policies OR together,
-- these let any authenticated crew member fabricate/edit recap rows by naming
-- themselves as manager_id. The remaining `recaps insert manager` policy correctly
-- enforces `is_manager(auth.uid())` on insert, and `recaps update` covers manager/owner
-- update paths (only manager-authored rows can exist once the loose insert is gone).
DROP POLICY IF EXISTS "Authors can insert own recap" ON public.daily_recaps;
DROP POLICY IF EXISTS "Authors can update own draft recap" ON public.daily_recaps;