
-- 1) Replace overly-broad SELECT policy
DROP POLICY IF EXISTS "profiles readable to crew" ON public.profiles;

CREATE POLICY "profiles readable to self manager or coworker"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_manager(auth.uid())
    OR (
      trailer_id IS NOT NULL
      AND trailer_id = (SELECT p.trailer_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- 2) Tighten column-level grants: hide sensitive timestamps and archive metadata from crew.
--    Managers/owners reach these via SECURITY DEFINER paths or service_role on the server.
REVOKE SELECT (last_login_at, archived_at, archived_by, archive_reason) ON public.profiles FROM authenticated;

-- email column-level revoke was applied in a prior migration; reassert to be safe (no-op if already revoked)
REVOKE SELECT (email) ON public.profiles FROM authenticated;

-- service_role keeps full access for server-side admin reads
GRANT SELECT ON public.profiles TO service_role;
