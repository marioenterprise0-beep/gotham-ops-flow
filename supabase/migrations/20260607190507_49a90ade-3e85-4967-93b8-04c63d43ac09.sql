-- 1) Tighten storage SELECT on gotham-photos
DROP POLICY IF EXISTS "photos read crew" ON storage.objects;
DROP POLICY IF EXISTS "sop_photos_read" ON storage.objects;

CREATE POLICY "gotham_photos_read_own_or_manager"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gotham-photos'
  AND (
    owner = auth.uid()
    OR public.is_manager(auth.uid())
  )
);

-- 2) Restrict reads of profiles.email to managers/owners + service_role
REVOKE SELECT (email) ON public.profiles FROM authenticated;
GRANT SELECT (email) ON public.profiles TO service_role;