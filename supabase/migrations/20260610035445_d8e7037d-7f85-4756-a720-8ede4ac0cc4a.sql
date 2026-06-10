-- Daily recap: support crew + manager recaps
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'manager',
  ADD COLUMN IF NOT EXISTS crew_summary text;

ALTER TABLE public.daily_recaps
  DROP CONSTRAINT IF EXISTS daily_recaps_kind_check;
ALTER TABLE public.daily_recaps
  ADD CONSTRAINT daily_recaps_kind_check CHECK (kind IN ('crew','manager'));

-- Allow any authenticated employee to insert their own recap and read it
DROP POLICY IF EXISTS "Authors can insert own recap" ON public.daily_recaps;
CREATE POLICY "Authors can insert own recap"
  ON public.daily_recaps FOR INSERT
  TO authenticated
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "Authors can read own recap" ON public.daily_recaps;
CREATE POLICY "Authors can read own recap"
  ON public.daily_recaps FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid() OR public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "Authors can update own draft recap" ON public.daily_recaps;
CREATE POLICY "Authors can update own draft recap"
  ON public.daily_recaps FOR UPDATE
  TO authenticated
  USING (manager_id = auth.uid() AND status IN ('draft','submitted'))
  WITH CHECK (manager_id = auth.uid());
