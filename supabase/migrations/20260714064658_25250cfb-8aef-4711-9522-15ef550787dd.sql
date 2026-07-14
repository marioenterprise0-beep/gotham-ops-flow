CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  org uuid := public.current_organization_id();
BEGIN
  IF org IS NULL THEN
    RAISE EXCEPTION 'has_role: no active organization on session (app.active_organization_id unset)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND organization_id = org
       AND role = _role
  );
END $$;