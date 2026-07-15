-- Returns the caller's user_roles.role values scoped to the active org GUC.
-- Used by app auth-guards (requireTabAccess) so multi-org callers can't
-- see roles from a different org they belong to.
CREATE OR REPLACE FUNCTION public.my_active_org_roles()
RETURNS app_role[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org uuid := public.current_organization_id();
BEGIN
  IF uid IS NULL OR org IS NULL THEN
    RETURN ARRAY[]::app_role[];
  END IF;
  RETURN COALESCE(
    (SELECT array_agg(DISTINCT role)
       FROM public.user_roles
      WHERE user_id = uid AND organization_id = org),
    ARRAY[]::app_role[]
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.my_active_org_roles() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_active_org_roles() TO authenticated, service_role;