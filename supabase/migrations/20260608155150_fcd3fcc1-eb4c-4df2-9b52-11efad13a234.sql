DROP POLICY IF EXISTS "grants self create" ON public.active_location_grants;

CREATE POLICY "grants approved request create"
  ON public.active_location_grants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.location_access_requests lar
      WHERE lar.id = request_id
        AND lar.requested_by = auth.uid()
        AND lar.requested_trailer_id = trailer_id
        AND lar.status = 'approved'
        AND lar.code_expires_at IS NOT NULL
        AND lar.code_expires_at > now()
    )
  );