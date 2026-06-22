-- is_super_admin() hardcoded two email addresses directly in SQL, while
-- the application side already read the same list from an env var
-- (SUPER_ADMIN_EMAILS) — two separate sources of truth that could drift
-- out of sync on a rotation. Moves the flag onto profiles itself; this
-- UPDATE is the last place these emails appear in source, used only
-- once to seed the column from the previous hardcoded list.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET is_super_admin = true
  WHERE lower(email) IN ('mario.enterprise0@gmail.com', 'mario@gothamhalal.com');

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- profiles.is_super_admin qualified explicitly -- a bare reference
  -- would already resolve to the column, not recurse into this function
  -- (a no-paren identifier can never be parsed as a function call), but
  -- spelling it out removes any doubt given what this function guards.
  SELECT coalesce(profiles.is_super_admin, false) FROM public.profiles WHERE profiles.id = _user_id
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;

-- Not granted to authenticated: same treatment as email/archive_reason —
-- only readable through the SECURITY DEFINER function above, never as a
-- raw column off a direct profiles select.
