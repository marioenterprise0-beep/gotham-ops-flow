-- Allow object owners to update their own gotham-photos (metadata, replace)
CREATE POLICY "gotham_photos_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'gotham-photos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'gotham-photos' AND owner = auth.uid());