ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET is_super_admin = true
  WHERE lower(email) IN ('mario.enterprise0@gmail.com', 'mario@gothamhalal.com');

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(profiles.is_super_admin, false) FROM public.profiles WHERE profiles.id = _user_id
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;