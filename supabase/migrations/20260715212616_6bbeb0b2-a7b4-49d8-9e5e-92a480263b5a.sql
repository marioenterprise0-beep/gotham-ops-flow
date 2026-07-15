BEGIN;

CREATE OR REPLACE FUNCTION public.set_active_org_context()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  SELECT p.active_organization_id INTO org
    FROM public.profiles p
   WHERE p.id = uid
     AND EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.user_id = uid
          AND m.organization_id = p.active_organization_id
     );
  IF org IS NOT NULL THEN
    PERFORM set_config('app.active_organization_id', org::text, true);
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_active_org_context() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_active_org_context() TO authenticated, service_role;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.set_active_org_context';
NOTIFY pgrst, 'reload config';

COMMIT;