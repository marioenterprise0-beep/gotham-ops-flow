CREATE TABLE IF NOT EXISTS public.availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  all_day boolean NOT NULL DEFAULT true,
  reason text CHECK (char_length(reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_blocks_user_date_unique UNIQUE (user_id, block_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_blocks TO authenticated;
GRANT ALL ON public.availability_blocks TO service_role;

ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avail_own_all"
  ON public.availability_blocks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "avail_manager_read"
  ON public.availability_blocks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager', 'shift_lead')
    )
  );