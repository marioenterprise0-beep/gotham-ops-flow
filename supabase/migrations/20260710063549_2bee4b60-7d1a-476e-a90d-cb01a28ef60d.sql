
-- Add approval workflow to availability_blocks
ALTER TABLE public.availability_blocks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved','declined')),
  ADD COLUMN IF NOT EXISTS trailer_id uuid REFERENCES public.trailers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL;

-- Allow managers/owners to update (approve/decline) any availability request
DROP POLICY IF EXISTS "avail_manager_update" ON public.availability_blocks;
CREATE POLICY "avail_manager_update"
  ON public.availability_blocks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner','manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner','manager')
    )
  );
