CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(email, '')) IN ('mario.enterprise0@gmail.com', 'mario@gothamhalal.com')
  FROM public.profiles WHERE id = _user_id
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;