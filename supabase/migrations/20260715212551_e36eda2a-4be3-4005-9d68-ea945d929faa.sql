BEGIN;

ALTER TABLE public._org_resolution ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._org_resolution FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public._org_resolution TO service_role;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('app.active_organization_id', true), '')::uuid
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_org_id() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enforce_org_id() TO service_role;

DO $g$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.is_org_member(uuid, uuid)',
    'public.has_org_role(uuid, uuid, public.org_role)',
    'public.has_role(uuid, public.app_role)',
    'public.has_role(uuid, uuid, public.app_role)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $g$;

COMMIT;