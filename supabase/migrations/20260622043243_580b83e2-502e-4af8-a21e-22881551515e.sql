
-- Replace recursive SELECT policy on profiles with one that uses a SECURITY DEFINER helper.
-- The previous version selected from public.profiles inside its own USING clause, which
-- re-evaluates the same policy and triggers "infinite recursion detected in policy".

DROP POLICY IF EXISTS "profiles readable to self manager or coworker" ON public.profiles;

CREATE OR REPLACE FUNCTION public.my_trailer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trailer_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "profiles readable to self manager or coworker"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_manager(auth.uid())
    OR (trailer_id IS NOT NULL AND trailer_id = public.my_trailer_id())
  );
